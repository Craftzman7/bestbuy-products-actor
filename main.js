const Apify = require('apify')
const { handleStart, handleDetail } = require('./src/routes')

const { utils: { log } } = Apify

Apify.main(async () => {
  const {
    proxyConfig = { useApifyProxy: true },
    startUrls,
    addImages = true,
    addTopReviews = true,
    maxProductsCnt = 0,
    maxConcurrency = 10,
    maxRequestRetries = 5,
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
    }
  })

  log.info('Starting the crawl.')
  await crawler.run()
  log.info('Crawl finished.')
})
