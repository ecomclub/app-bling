'use strict'
const logger = require('console-files')

module.exports = (storeId, appSdk) => {
  return (configObj) => {
    return new Promise(async (resolve, reject) => {
      // check if the app is able to sync
      if (!configObj.hasOwnProperty('synchronize') ||
        (configObj.hasOwnProperty('synchronize') && configObj.synchronize === null) ||
        (configObj.hasOwnProperty('synchronize') && !configObj.synchronize.hasOwnProperty('ecomplus')) ||
        (configObj.synchronize.hasOwnProperty('ecomplus') && !configObj.synchronize.ecomplus.hasOwnProperty('products')) ||
        ((configObj.synchronize.ecomplus.products.hasOwnProperty('all') && configObj.synchronize.ecomplus.products.all === false) && (configObj.synchronize.ecomplus.products.ids && !configObj.synchronize.ecomplus.products.ids.length))
      ) {
        // if not, next job
        resolve({ configObj })
      } else {
        try {
          console.log('--> Sync products started')
          // array for products ids
          let productsId = []

          // sync all products?
          if (configObj.synchronize.ecomplus.products.all && configObj.synchronize.ecomplus.products.all === true) {
            let resource = '/products.json'
            let method = 'GET'
            let request = await appSdk.apiRequest(storeId, resource, method)
            let { result } = request.response.data
            result.forEach(product => productsId.push(product._id))
          }

          // sync only ids informed
          if (configObj.synchronize.ecomplus.products.ids && configObj.synchronize.ecomplus.products.ids.length > 0) {
            productsId = configObj.synchronize.ecomplus.products.ids
          }

          // logs vars
          let syncLenght = productsId.length
          let syncStartTime = Date.now()
          let syncStartTimeDate = new Date().toISOString()
          let syncSuccessful = 0
          let syncFailed = 0
          let syncErrors = []

          const insertProduct = require('./bling/insert-product')(storeId, configObj)

          // prevent http 429 at async requests
          const sleep = ms => {
            return (new Promise(function (resolve, reject) {
              setTimeout(function () { resolve() }, ms)
            }))
          }

          // sync array of products to bling
          const sync = productsId.map(async (productId, i) => {
            await sleep(i * 100)
            let resource = `/products/${productId}.json`
            let method = 'GET'
            let inserted = await appSdk
              .apiRequest(storeId, resource, method)
              .then(insertProduct)
              .catch(e => {
                // save request error to show at dashboard
                syncFailed++
                syncErrors.push({
                  'id': syncFailed,
                  'date': new Date().toISOString(),
                  'message': e.retorno.erros[0].erro.msg,
                  'type': 'Produto',
                  'resource_id': productId
                })
              })

            if (inserted) {
              syncSuccessful++
            }

            return inserted
          })

          // resolve promises
          await Promise
            .all(sync)
            .then(() => {
              // prepares the synchronization log
              let info = {
                'sync': {
                  'total': syncLenght,
                  'successful': syncSuccessful,
                  'failed': syncFailed
                },
                'type': 'products',
                'to': 'bling',
                'started_at': syncStartTimeDate,
                'ended_at': new Date().toISOString(),
                'took': Date.now() - syncStartTime,
                'erros': syncErrors
              }
              let payload = configObj.hasOwnProperty('last_sync') ? configObj.last_sync : []
              payload.unshift(info)

              // save at application.hidden_data
              require('./store-api/update-config')(appSdk, storeId, configObj.application_id)(payload)

              // next
              resolve({ configObj })
            })
        } catch (error) {
          logger.error('--> Error: sync products to bling;', error)
          reject(error)
        }
      }
    })
  }
}
