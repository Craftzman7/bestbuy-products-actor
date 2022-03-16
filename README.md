# bestbuy-products-actor

## What does Best Buy Products Scraper do?

Our free Best Buy product data scraper allows you to scrape product information from one of the most popular consumer electronics retailers: [bestbuy.com](https://www.bestbuy.com/)

Best Buy Products Scraper lets you extract data on: 

- Product categories
- Product names
- URLs
- Current prices
- Original prices
- Sales
- Ratings
- Availability

You can certainly use the official Best Buy API to download product information from Best Buy. But getting comprehensive data in machine-readable format is a little tricky, especially at scale, as there are limits to how much Best Buy product data you can get. Our Best Buy Products Scraper lets you overcome these limitations. 

## How much will it cost me to use?

Best Buy Products Scraper consumes 1 compute unit per 1,000 results. That means you will pay approx. 25 cents for 1,000 results.

## Input

- Insert the category URL from the 'Shop deals by category' section of the Best Buy website.

- Choose the maximum count of products to be scraped.

- Select a proxy option from the proxy box (recommended).

- Select the proxy country you want to us.

- Click *Run* and wait for the results to come in.

### Example

{"startUrls":[{"url":"https://www.bestbuy.com/site/promo/tv-deals"}],"proxy":{"useApifyProxy":true},"maxProducts":0}

## Output

- After the actor finishes its run, it will store the results in *Dataset*.

- Go to *Dataset*, and select the format you want from the export box.

### Example results
```json
{
  "name": "Samsung - Galaxy A52 5G 128GB (Unlocked) - Black",
  "image": "https://pisces.bbystatic.com/image2/BestBuy_US/images/products/6452/6452968_sd.jpg",
  "url": "https://www.bestbuy.com/site/samsung-galaxy-a52-5g-128gb-unlocked-black/6452968.p?skuId=6452968",
  "description": "Shop Samsung Galaxy A52 5G 128GB (Unlocked) Black at Best Buy. Find low everyday prices and buy online for delivery or in-store pick-up. Price Match Guarantee.",
  "sku": "6452968",
  "gtin13": "0887276536330",
  "model": "SM-A526UZKDXAA",
  "color": "Black",
  "brand": {
    "name": "Samsung"
  },
  "aggregateRating": {
    "ratingValue": "4.4",
    "reviewCount": "198"
  },
  "offers": {
    "priceCurrency": "USD",
    "seller": {
      "name": "Best Buy"
    },
    "lowPrice": "349.99",
    "highPrice": "499.99",
    "offercount": 10,
    "offers": [
      {
        "priceCurrency": "USD",
        "price": "499.99",
        "availability": "InStock",
        "itemCondition": "NewCondition",
        "description": "New",
        "offers": [
          {
            "priceCurrency": "USD",
            "price": "499.99",
            "itemCondition": "NewCondition",
            "description": "FULL_SRP SPR Unlocked Upgrade"
          },
          {
            "priceCurrency": "USD",
            "price": "499.99",
            "itemCondition": "NewCondition",
            "description": "FULL_SRP TMO Unlocked Upgrade"
          },
          {
            "priceCurrency": "USD",
            "price": "499.99",
            "itemCondition": "NewCondition",
            "description": "FULL_SRP VZW Unlocked Upgrade"
          },
          {
            "priceCurrency": "USD",
            "price": "499.99",
            "itemCondition": "NewCondition",
            "description": "FULL_SRP ATT Unlocked New"
          },
          {
            "priceCurrency": "USD",
            "price": "499.99",
            "itemCondition": "NewCondition",
            "description": "FULL_SRP VZW Unlocked New"
          },
          {
            "priceCurrency": "USD",
            "price": "399.99",
            "itemCondition": "NewCondition",
            "description": "FULL_SRP TMO Unlocked New"
          }
        ]
      },
      {
        "priceCurrency": "USD",
        "price": "409.99",
        "availability": "InStock",
        "itemCondition": "UsedCondition",
        "description": "Open-Box Excellent"
      },
      {
        "priceCurrency": "USD",
        "price": "374.99",
        "itemCondition": "UsedCondition",
        "description": "Open-Box Satisfactory"
      },
      {
        "priceCurrency": "USD",
        "price": "349.99",
        "itemCondition": "UsedCondition",
        "description": "Open-Box Fair"
      }
    ]
  },
  "images": [
    "https://pisces.bbystatic.com/image2/BestBuy_US/images/products/6452/6452968_sd.jpg",
    "https://pisces.bbystatic.com/image2/BestBuy_US/images/products/6452/6452968cv11d.jpg",
    "https://pisces.bbystatic.com/image2/BestBuy_US/images/products/6452/6452968cv12d.jpg",
    "https://pisces.bbystatic.com/image2/BestBuy_US/images/products/6452/6452968cv13d.jpg",
    "https://pisces.bbystatic.com/image2/BestBuy_US/images/products/6452/6452968cv14d.jpg",
    "https://pisces.bbystatic.com/image2/BestBuy_US/images/products/6452/6452968cv15d.jpg",
    "https://pisces.bbystatic.com/image2/BestBuy_US/images/products/6452/6452968cv16d.jpg"
  ]
}
```

## Notes

For more information on the Apify platform, Apify actors, and the Apify CLI, check out the links below.

-  [Apify SDK](https://sdk.apify.com/)

-  [Apify Actor documentation](https://docs.apify.com/actor)

-  [Apify CLI](https://docs.apify.com/cli)