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

const getProductFromInlineJSON = ($, userData) => {
  const {
    addImages,
    addTopReviews
  } = userData

  const inlineObjects = Array.from($('script[type="application/ld+json"]')).map(x => JSON.parse($(x).html()))

  let productObject = inlineObjects?.find(x => x['@type'] === 'Product')

  let images
  if (addImages) {
    const rawImages = inlineObjects?.find(x => Array.isArray(x))
    images = rawImages ? rawImages.map(x => x?.thumbnailUrl) : undefined
  }

  let reviews
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

exports.handleStart = async (context) => {
  const {
    $,
    crawler: { requestQueue },
    request: { url, userData }
  } = context

  const product = getProductFromInlineJSON($, userData)

  // if product page specified as startUrl then process it as a single product
  if (product) {
    return handleDetail(context)
  }

  const domain = getDomainFromUrl(url)
  const productLinks = Array.from($('a[href*="skuId="]')).map(x => $(x).attr('href'))
  const allSkuIds = productLinks?.map(x => new URL(x, domain).searchParams.get('skuId'))
  const uniqueSkuIds = [...new Set(allSkuIds)]

  if (!uniqueSkuIds?.length) {
    throw new Error(`NO SKU(s) ${url}`)
  }

  log.info(`Found ${uniqueSkuIds?.length} SKU(s) at ${url}`)

  for (const skuId of uniqueSkuIds) {
    await requestQueue.addRequest({
      // product available by sku-pattern, it will be redirected to full url
      url: new URL(`/site/${skuId}.p?skuId=${skuId}`, domain).href, // `${domain}/site/${skuId}.p?skuId=${skuId}`,
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

const handleDetail = exports.handleDetail = async (context) => {
  const {
    $,
    request: { url, userData }
  } = context

  const product = getProductFromInlineJSON($, userData)

  // if product page specified as startUrl then process it as a single product
  if (!product) {
    throw new Error(`NO product ${url}`)
  }

  await Apify.pushData(product)

  log.info(product?.url)
}
