const Apify = require('apify');
// eslint-disable-next-line import/no-extraneous-dependencies
const _ = require('lodash');
const omitDeep = require('omit-deep-lodash');

const { utils: { log } } = Apify;

const getDomainFromUrl = (url) => {
    return new URL(url)?.origin;
};

const replacePropertyValue = (checkVal, newVal, object) => {
    const newObject = _.clone(object);

    _.each(object, (val, key) => {
        if (checkVal(val)) {
            newObject[key] = newVal(val);
        } else if (typeof (val) === 'object') {
            newObject[key] = replacePropertyValue(checkVal, newVal, val);
        }
    });

    return newObject;
};

const evalJSInit = (body) => {
    const jsPrefix = 'window.__INITIAL_STATE__ = ';
    const jsPostfix = '};';
    const i1 = body.indexOf(jsPrefix);
    if (i1 < 0) {
        return;
    }
    const i2 = body.indexOf(jsPostfix, i1);
    if (i2 < 0) {
        return;
    }
    const jsText = body.substr(i1 + jsPrefix.length, i2 - i1 - jsPrefix.length + 1).trim();
    let rawData;
    try {
        rawData = JSON.parse(jsText);
    } catch (err) {
        log.warning('CorruptedJSONjsText');
        return;
    }

    return rawData?.product;
};

const getProductFromInlineJSON = ($, request, response) => {
    const { userData } = request;
    const {
        addImages,
        addTopReviews,
    } = userData;

    const inlineObjects = Array.from($('script[type="application/ld+json"]')).map((x) => JSON.parse($(x).html()));

    let images;
    let reviews;

    let productObject = inlineObjects?.find((x) => x['@type'] === 'Product');
    // if there is product from metadata then customize and return it
    if (productObject) {
        if (addImages) {
            const rawImages = inlineObjects?.find((x) => Array.isArray(x));
            images = rawImages ? rawImages.map((x) => x?.thumbnailUrl) : undefined;
        }

        if (addTopReviews) {
            const rawReviews = inlineObjects?.filter((x) => x['@type'] === 'Review');
            reviews = rawReviews?.length ? rawReviews : undefined;
        }

        productObject = productObject ? {
            ...productObject,
            images,
            reviews,
        } : null;

        productObject = omitDeep(productObject, ['@type', '@context', 'itemReviewed', 'publisher', 'bestRating']);
        const removeSchemaUrl = 'http://schema.org/';
        const isSchemaString = (value) => _.isString(value) && value.startsWith(removeSchemaUrl);
        const removeSchemaPrefix = (value) => value.substring(removeSchemaUrl.length);
        productObject = replacePropertyValue(isSchemaString, removeSchemaPrefix, productObject);

        return productObject;
    }

    // fall back to product defined in window.__INITIAL_STATE__
    const initStateProduct = evalJSInit($.root().html());
    // no SKU means its product placeholder, not really a product, must be ignored
    if (initStateProduct?.product?.sku) {
        productObject = initStateProduct?.product;
        if (addImages) {
            images = productObject?.additionalImages || undefined;
        }
        if (addTopReviews) {
            reviews = initStateProduct?.customerReviews?.customerReviews || undefined;
            if (reviews) {
                reviews = omitDeep(reviews, ['syndicationSource']);
            }
        }

        productObject = {
            url: response?.url || request?.url || undefined,
            ...productObject,
            ...initStateProduct?.customerReviews?.ratingSummary,
            images,
            reviews,
        };

        productObject = _.omit(productObject, ['seoText', 'altLangSeoText', 'additionalImages', 'media', 'isMachineTranslated']);

        return productObject;
    }
};

const handleProductData = async (product) => {
    if (product?.sku && product?.url?.toLowerCase()?.includes('www.bestbuy.com/')) {
        const rq = await Apify.openRequestQueue();
        // add more details by separate request
        await rq.addRequest({
            // eslint-disable-next-line max-len
            url: `https://www.bestbuy.com/api/tcfb/model.json?paths=%5B%5B%22shop%22%2C%22magellan%22%2C%22v2%22%2C%22product%22%2C%22skus%22%2C${product.sku}%5D%5D&method=get`,
            userData: {
                product,
                dataType: 'productApiDetails',
            },
        });
        return;
    }
    await Apify.pushData(product);
};

exports.handleStart = async (context) => {
    const {
        $,
        crawler: { requestQueue },
        request,
        response,
    } = context;

    const { url, userData } = request;

    const product = getProductFromInlineJSON($, request, response);

    // if product page specified as startUrl then process it as a single product
    if (product) {
        return handleProductData(product);
    }

    const domain = getDomainFromUrl(url);
    const isDotCom = domain.endsWith('.com');
    const productLinkPattern = isDotCom ? 'a[href*="skuId="]' : 'a[href*="/product/"]';
    const productLinks = Array.from($(productLinkPattern)).map((x) => $(x).attr('href'));
    const allSkuIds = productLinks?.map((x) => {
        const productUrl = new URL(x, domain);
        return isDotCom ? productUrl.searchParams.get('skuId') : productUrl.pathname.split('/').pop();
    });
    const uniqueSkuIds = [...new Set(allSkuIds)];

    if (!uniqueSkuIds?.length) {
        throw new Error(`NO SKUs ${url}`);
    }

    log.info(`SKUs found: ${uniqueSkuIds?.length} at ${url}`);

    const domainPathPrefix = new URL(url).pathname.split('/').filter((x) => x).shift();
    for (const skuId of uniqueSkuIds) {
        const skuPattern = isDotCom ? `/site/${skuId}.p?skuId=${skuId}` : `/${domainPathPrefix}/product/${skuId}`;
        const skuBasedUrl = new URL(skuPattern, domain);
        if (!skuBasedUrl.href.includes('bestbuy')) {
            log.warning('Unable to craft product href', { skuPattern, domain });
            // eslint-disable-next-line no-continue
            continue;
        }
        await requestQueue.addRequest({
            // product available by sku-pattern, it will be redirected to full url
            url: skuBasedUrl.href,
            userData: { ...userData, dataType: 'product' },
        },
        {
            forefront: true,
        });
    }

    const nextPage = $('a.sku-list-page-next')?.attr('href');

    if (nextPage) {
        await requestQueue.addRequest({
            url: new URL(nextPage, domain).href,
            userData,
        });
    }
};

exports.handleDetail = async (context) => {
    const {
        $,
        request,
        response,
    } = context;

    const product = getProductFromInlineJSON($, request, response);

    // if product page specified as startUrl then process it as a single product
    if (!product) {
        throw new Error(`NO product ${request.url}`);
    }

    return handleProductData(product);
};

const apiRequest = (basedUrl, userData) => {
    const {
        domain,
        id,
        apiType,
        lang = 'en-CA',
        path = '',
        page = 1,
    } = userData;
    // Full examples
    // eslint-disable-next-line max-len
    // https://www.bestbuy.ca/api/v2/json/search?categoryid=&currentRegion=ON&include=facets%2C%20redirects&lang=en-CA&page=&pageSize=100&path=&query=10389044%2012405503%2014878830%2013015772%2010325890%2014961198%2014196216%2015446669%2014582292%2014961201%2014700331%2010372188&exp=&sortBy=relevance&sortDir=desc
    // eslint-disable-next-line max-len
    // https://www.bestbuy.ca/api/v2/json/sku-collections/217126?categoryid=&currentRegion=ON&include=facets%2C%20redirects&lang=en-CA&page=1&pageSize=24&path=&query=&exp=&sortBy=price&sortDir=asc
    const craftUrl = new URL(basedUrl);
    craftUrl.searchParams.set('lang', lang);
    craftUrl.searchParams.set('page', page);
    craftUrl.searchParams.delete('path'); // weird bug, need to add as a string
    return {
        url: `${craftUrl.href}&path=${path}`,
        userData: { domain, id, apiType, lang, path, page },
    };
};

exports.transformUrlToInternalAPI = (startUrlObj) => {
    // data leak for bestbuy.ca allows just transform
    // https://www.bestbuy.ca/api/v2/json/sku-collections/217126
    // https://www.bestbuy.ca/api/v2/json/search?categoryid=30438
    // if we keep path query parameter, filtering will be applied
    const urlObj = new URL(startUrlObj.url);
    const domain = urlObj.origin;
    const pathVariables = new URL(urlObj).pathname.split('/').filter((x) => x);
    const languagePrefix = pathVariables.shift().split('-');
    let lang;
    if (languagePrefix?.length === 2) {
        lang = `${languagePrefix[0]}-${languagePrefix[1].toUpperCase()}`;
    }
    const id = pathVariables.pop();
    let path = decodeURIComponent(urlObj.searchParams.get('path'));
    path = encodeURIComponent(path.split('+').join(' '));
    let apiUrl;
    let apiType;
    if (pathVariables.includes('collection')) {
        apiUrl = `${urlObj.origin}/api/v2/json/sku-collections/${id}`;
        apiType = 'collection';
    }
    if (pathVariables.includes('category')) {
        apiUrl = `${urlObj.origin}/api/v2/json/search?categoryid=${id}`;
        apiType = 'category';
    }
    if (!apiUrl) {
        log.warning('Unable transformUrlToInternalAPI', startUrlObj);
        return;
    }
    // userData ignored for API calls
    return apiRequest(apiUrl, { domain, id, apiType, lang, path });
};

exports.handleInternalApiJson = async (context) => {
    const {
        request,
        crawler: { requestQueue },
        json,
    } = context;

    const { url, userData } = request;

    const {
        currentPage,
        totalPages,
        products,
    } = json;

    if (!products) {
        throw new Error(`NO API products ${url}`);
    }

    const { domain } = userData;

    const apiProducts = products.map((x) => {
        // eslint-disable-next-line no-shadow
        const url = new URL(x.productUrl, domain).href.replace('.aspx?', '');
        let product = { url, ...x };
        product = _.omit(product, ['seoText', 'altLangSeoText', 'hideSavings', 'hideSaleEndDate', 'currentRegion']);
        product.productUrl = undefined;
        if (product.saleEndDate) {
            product.saleEndDate = new Date(product.saleEndDate);
        }
        return product;
    });
    await handleProductData(apiProducts);

    // direct request brings a bit more details, probably make no sense to do it, skipped for now
    /*
  for (const skuId of products.map(x => x.sku)) {
    await requestQueue.addRequest({
      url: `${domain}/${userData.lang}/product/${skuId}`,
      userData: { dataType: 'product' }
    },
    {
      forefront: true
    })
  }
  */

    // add all other pages as API calls
    let page = currentPage + 1;
    while (page <= totalPages) {
        const addApiRequest = apiRequest(url, { ...userData, page });
        await requestQueue.addRequest(addApiRequest);
        page++;
    }
};

exports.handleApiDetails = async (context) => {
    const { json, request } = context;
    const { userData: { product } } = request;
    const rawData = json.jsonGraph?.shop?.magellan?.v2?.product?.skus;
    if (!rawData) {
        await Apify.pushData(product);
        return;
    }
    const details = Object.values(rawData)?.[0]?.value;
    if (details?.operationalAttributes) {
        details.fromManufacturer = details.operationalAttributes;
        details.operationalAttributes = undefined;
    }
    // Format specifications correctly
    for (const spec of rawData?.[0]?.value.specifications || []) {
        // Format it so each spec is an object with a key and value
        spec.key = spec.displayName;
        spec.value = spec.values.join(', ');
        console.log(spec);
    }
    await Apify.pushData({
        ...product,
        ...details,
        skuId: undefined,
        images: product.images || details.images,
    });
};
