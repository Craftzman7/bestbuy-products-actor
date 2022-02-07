const Apify = require('apify')
const _ = require('lodash')
const omitDeep = require('omit-deep-lodash')

const { utils: { log } } = Apify

const getDomainFromUrl = (url) => {
  return new URL(url)?.origin
}

const replacePropertyValue = (checkVal, newVal, object) => {
  const newObject = _.clone(object)

  _.each(object, (val, key) => {
    if (checkVal(val)) {
      newObject[key] = newVal(val)
    } else if (typeof (val) === 'object') {
      newObject[key] = replacePropertyValue(checkVal, newVal, val)
    }
  })

  return newObject
}

const evalJSInit = (body) => {

  const jsPrefix = 'window.__INITIAL_STATE__ = '
  const jsPostfix = '};'
  const i1 = body.indexOf(jsPrefix)
  if (i1 < 0) {
    return
  }
  const i2 = body.indexOf(jsPostfix, i1)
  if (i2 < 0) {
    return
  }
  const jsText = body.substr(i1 + jsPrefix.length, i2 - i1 - jsPrefix.length + 1).trim()
  let rawData
  try {
    rawData = JSON.parse(jsText)
  } catch (err) {
    log.warning(`CorruptedJSONjsText`)
    return
  }

  return rawData?.product
}

const getProductFromInlineJSON = ($, request, response) => {
  const { userData } = request
  const {
    addImages,
    addTopReviews
  } = userData

  const inlineObjects = Array.from($('script[type="application/ld+json"]')).map(x => JSON.parse($(x).html()))

  let images
  let reviews

  let productObject = inlineObjects?.find(x => x['@type'] === 'Product')
  // if there is product from metadata then customize and return it
  if (productObject) {
    if (addImages) {
      const rawImages = inlineObjects?.find(x => Array.isArray(x))
      images = rawImages ? rawImages.map(x => x?.thumbnailUrl) : undefined
    }
  
    if (addTopReviews) {
      const rawReviews = inlineObjects?.filter(x => x['@type'] === 'Review')
      reviews = rawReviews?.length ? rawReviews : undefined
    }
  
    productObject = productObject ? {
      ...productObject,
      images,
      reviews
    } : null
  
    productObject = omitDeep(productObject, ['@type', '@context', 'itemReviewed', 'publisher', 'bestRating'])
    const removeSchemaUrl = 'http://schema.org/'
    const isSchemaString = value => _.isString(value) && value.startsWith(removeSchemaUrl)
    const removeSchemaPrefix = value => value.substring(removeSchemaUrl.length)
    productObject = replacePropertyValue(isSchemaString, removeSchemaPrefix, productObject)
  
    return productObject  
  }


  // fall back to product defined in window.__INITIAL_STATE__
  const initStateProduct = evalJSInit($.root().html())
  // no SKU means its product placeholder, not really a product, must be ignored
  if (initStateProduct?.product?.sku) {
    productObject = initStateProduct?.product
    if (addImages) {
      images = productObject?.additionalImages || undefined
    }  
    if (addTopReviews) {
      reviews = initStateProduct?.customerReviews?.customerReviews || undefined
      if (reviews) {
        reviews = omitDeep(reviews, ['syndicationSource' ])
      }
    }

    productObject = {
      url: response?.url || request?.url || undefined,
      ...productObject,
      ...initStateProduct?.customerReviews?.ratingSummary,
      images,
      reviews
    }

    productObject = _.omit(productObject, ['seoText', 'altLangSeoText', 'additionalImages', 'media', 'isMachineTranslated'])

    return productObject
  }

}

const handleProductData = async (product) => {

  await Apify.pushData(product)

}

exports.handleStart = async (context) => {
  const {
    $,
    crawler: { requestQueue },
    request,
    response
  } = context

  const { url, userData } = request

  const product = getProductFromInlineJSON($, request, response)

  // if product page specified as startUrl then process it as a single product
  if (product) {
    return handleProductData(product)
  }

  const domain = getDomainFromUrl(url)
  const isDotCom = domain.endsWith('.com')
  const productLinkPattern = isDotCom ? 'a[href*="skuId="]' : 'a[href*="/product/"]'
  const productLinks = Array.from($(productLinkPattern)).map(x => $(x).attr('href'))
  const allSkuIds = productLinks?.map(x => {
    const productUrl = new URL(x, domain)
    return isDotCom ? productUrl.searchParams.get('skuId') : productUrl.pathname.split('/').pop()
  })
  const uniqueSkuIds = [...new Set(allSkuIds)]

  if (!uniqueSkuIds?.length) {
    throw new Error(`NO SKUs ${url}`)
  }

  log.info(`SKUs found: ${uniqueSkuIds?.length} at ${url}`)

  const domainPathPrefix = new URL(url).pathname.split('/').filter(x => x).shift()
  for (const skuId of uniqueSkuIds) {
    const skuPattern = isDotCom ? `/site/${skuId}.p?skuId=${skuId}` : `/${domainPathPrefix}/product/${skuId}`
    const skuBasedUrl = new URL(skuPattern, domain)
    if (!skuBasedUrl.href.includes('bestbuy')) {
      log.warning(`Unable to craft product href`, { skuPattern, domain })
      continue
    }
    await requestQueue.addRequest({
      // product available by sku-pattern, it will be redirected to full url
      url: skuBasedUrl.href,
      userData: { ...userData, dataType: 'product' }
    },
    {
      forefront: true
    })
  }

  const nextPage = $('a.sku-list-page-next')?.attr('href')

  if (nextPage) {
    await requestQueue.addRequest({
      url: new URL(nextPage, domain).href,
      userData
    })
  }
}

exports.handleDetail = async (context) => {
  const {
    $,
    request,
    response
  } = context

  const product = getProductFromInlineJSON($, request, response)

  // if product page specified as startUrl then process it as a single product
  if (!product) {
    throw new Error(`NO product ${request.url}`)
  }

  return handleProductData(product)
}
