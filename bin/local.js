#!/usr/bin/env node

'use strict'

// log on files
const logger = require('console-files')
// handle app authentication to Store API
// https://github.com/ecomclub/ecomplus/application-sdk
const { ecomAuth } = require('@ecomplus/application-sdk')

logger.log('--> Start running daemon processes')

ecomAuth.then(appSdk => {
  // configure setup for stores
  // list of procedures to save
  const procedures = require('./../lib/store-api/procedures')
  if (procedures && procedures.length) {
    const { triggers } = procedures[0]
    if (triggers && triggers.length) {
      appSdk.configureSetup(procedures, (err, { storeId }) => {
        if (!err) {
          logger.log('--> Setup store #' + storeId)
        } else if (!err.appAuthRemoved) {
          logger.error(err)
        }
      })
    }
  }

  // products
  require('./../lib/ecomplus/products/save-in-db')(appSdk)
  require('./../lib/ecomplus/products/send-to-bling')(appSdk)
  // // orders
  require('./../lib/ecomplus/orders/save-in-db')(appSdk)
  require('./../lib/ecomplus/orders/sent-to-bling')(appSdk)
})

ecomAuth.catch(err => {
  logger.error(err)
  setTimeout(() => {
    // destroy Node process while Store API auth cannot be handled
    process.exit(1)
  }, 1000)
})

/* Run other app background processes here */
