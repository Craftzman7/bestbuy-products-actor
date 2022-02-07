const Apify = require('apify')
const { LOCAL_FILENAME_DIGITS } = require('apify/build/storages/dataset')
const { handleStart, handleDetail } = require('./src/routes')

const { utils: { log } } = Apify

Apify.main(async () => {
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
  } = await Apify.getInput()

  if (!startUrls?.length) {
    log.error('No startUrls data', { startUrls })
    return
  }

  const requestList = await Apify.openRequestList('start-urls', startUrls.map(x => {
    return {
      ...x,
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
        $,
        request: { url, userData }
      } = context

      const { dataType } = userData

      if ($ && !dataType) {
        return handleStart(context)
      } else if ($ && dataType === 'product') {
        return handleDetail(context)
      } else {
        log.error('UNHANDLED', { url })
      }
    },
    handleFailedRequestFunction: async (context) => {
      const {
        error,
        body,
        response
      } = context
      log.error(error?.message || error)
      // await Apify.setValue('error', body, { contentType: 'text/html' })
    }
  })

  log.info('Starting the crawl.')
  await crawler.run()
  log.info('Crawl finished.')
})
