'use strict'
const logger = require('console-files')
module.exports = (appSdk, configObj) => {
  return (trigger, storeId) => {
    const applicationId = trigger.resource_id || trigger.inserted_id

    if (trigger.action === 'change' && trigger.fields.includes('data')) {
      if (trigger.body.hasOwnProperty('synchronize') && trigger.body.synchronize.hasOwnProperty('ecomplus')) {
        const syncProducts = require('./../products-to-bling')(storeId, appSdk)
        const syncOrders = require('./../orders-to-bling')(storeId, appSdk)
        const syncEnd = require('./../end-sync')(storeId, appSdk, applicationId)

        syncProducts(configObj) // sync products
          .then(syncOrders) // sync orders
          .then(syncEnd) // update app
          .catch(error => {
            logger.log('--> Synchronization performed but there were errors. ', error)
          })
      }
    }
  }
}
