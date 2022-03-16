const Apify = require('apify')
const { handleStart, handleDetail, transformUrlToInternalAPI, handleInternalApiJson } = require('./src/routes')

const { utils: { log } } = Apify

Apify.main(async () => {
  const input = await Apify.getInput()

  input.maxProducts = parseInt(input.maxProducts) || 0

  const {
    proxyConfig = { useApifyProxy: true },
    startUrls,
    addImages = true,
    addTopReviews = true,
    maxProductsCnt = 0,
    minConcurrency = 10,
    maxConcurrency = 20,
    maxRequestRetries = 10,
    requestTimeoutSecs = 30
  } = input

  if (!startUrls?.length) {
    log.error('No startUrls data', { startUrls })
    return
  }

  const requestList = await Apify.openRequestList('start-urls', startUrls.map(x => {
    // replace links to collections by api requests
    const url = x.url.toLowerCase()
    if (url.startsWith('https://www.bestbuy.ca') && !url.includes('/api/v2/json') && (url.includes('/collection/') || url.includes('/category/'))) {
      const transformed = transformUrlToInternalAPI(x)
      if (transformed) {
        return transformed
      }
    }
    return {
      ...x,
      url,
      userData: { addImages, addTopReviews, ...x?.userData }
    }
  }))
  const requestQueue = await Apify.openRequestQueue()
  const proxyConfiguration = await Apify.createProxyConfiguration({ ...proxyConfig, countryCode: proxyConfig?.countryCode || 'US' })

  const crawler = new Apify.CheerioCrawler({
    requestList,
    requestQueue,
    proxyConfiguration,
    maxRequestsPerCrawl: maxProductsCnt ? startUrls.length + maxProductsCnt + 1 : undefined,
    minConcurrency,
    maxConcurrency,
    maxRequestRetries,
    requestTimeoutSecs,
    handlePageFunction: async (context) => {
      const {
        json,
        $,
        request: { url, userData }
      } = context

      const { dataType } = userData

      if ($ && !dataType) {
        return handleStart(context)
      } else if ($ && dataType === 'product') {
        return handleDetail(context)
      } else if (json) {
        return handleInternalApiJson(context, input)
      } else {
        log.error('UNHANDLED', { url })
      }
    },
    handleFailedRequestFunction: async (context) => {
      const {
        error
        // body
      } = context
      log.error(error?.message || error)
      // await Apify.setValue('error', body, { contentType: 'text/html' })
    }
  })

  log.info('Starting the crawl.')
  await crawler.run()
  log.info('Crawl finished.')
})
