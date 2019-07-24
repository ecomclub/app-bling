'use strict'
const logger = require('console-files')
module.exports = (storeId, appSdk) => {
  return ({ configObj }) => {
    return new Promise(async (resolve, reject) => {
      // check if the app is able to sync
      if (!configObj.hasOwnProperty('synchronize') ||
        (configObj.hasOwnProperty('synchronize') && configObj.synchronize === null) ||
        (configObj.hasOwnProperty('synchronize') && !configObj.synchronize.hasOwnProperty('ecomplus')) ||
        (configObj.synchronize.hasOwnProperty('ecomplus') && !configObj.synchronize.ecomplus.hasOwnProperty('orders')) ||
        ((configObj.synchronize.ecomplus.orders.hasOwnProperty('all') && configObj.synchronize.ecomplus.orders.all === false) && (configObj.synchronize.ecomplus.orders.ids && !configObj.synchronize.ecomplus.orders.ids.length))
      ) {
        // if not, next job
        resolve({ configObj })
      } else {
        // prevent http 429 at async requests
        const sleep = ms => {
          return (new Promise(function (resolve, reject) {
            setTimeout(function () { resolve() }, ms)
          }))
        }

        try {
          console.log('--> Sync orders started')
          // array for orders ids
          let orders = []

          // sync all orders?
          if (configObj.synchronize.ecomplus.orders.all && configObj.synchronize.ecomplus.orders.all === true) {
            let resource = 'orders.json?fields=_id,source_name,channel_id,number,code,status,financial_status.updated_at,financial_status.current,fulfillment_status.updated_at,fulfillment_status.current,amount,payment_method_label,shipping_method_label,buyers._id,buyers.main_email,buyers.display_name,items.product_id,items.sku,items.name,items.quantity,items.price,created_at,updated_atorders.json?fields=_id,source_name,channel_id,number,code,status,shipping_lines,transactions,financial_status.updated_at,financial_status.current,fulfillment_status.updated_at,fulfillment_status.current,amount,payment_method_label,shipping_method_label,buyers,items.product_id,items.sku,items.name,items.quantity,items.price,created_at,updated_at'
            let method = 'GET'
            let request = await appSdk.apiRequest(storeId, resource, method)
            orders = request.response.data.result
          }

          // sync only ids informed
          if (configObj.synchronize.ecomplus.orders.ids && configObj.synchronize.ecomplus.orders.ids.length > 0) {
            let results = configObj.synchronize.ecomplus.orders.ids.map(async (id, i) => {
              await sleep(1 * 1000)
              let resource = `orders/${id}.json`
              let method = 'GET'
              let request = await appSdk.apiRequest(storeId, resource, method)
              return request.response.data
            })
            orders = await Promise.all(results)
          }

          // logs vars
          let syncLenght = orders.length
          let syncStartTime = Date.now()
          let syncStartTimeDate = new Date().toISOString()
          let syncSuccessful = 0
          let syncFailed = 0
          let syncErrors = []

          const insertOrders = require('./../lib/bling/insert-orders')(storeId, configObj)

          // sync array of orders to bling
          let sync = orders.map(async (order, i) => {
            await sleep(i * 60)
            let inserted = await insertOrders(order)
              .catch(e => {
                // save request error to show at dashboard
                syncFailed++
                syncErrors.push({
                  'id': syncFailed,
                  'date': new Date().toISOString(),
                  'message': e.retorno.erros[0].erro.msg,
                  'type': 'Pedido',
                  'resource_id': order._id
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
              let info = {
                'sync': {
                  'total': syncLenght,
                  'successful': syncSuccessful,
                  'failed': syncFailed
                },
                'type': 'orders',
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
          logger.error('--> Error: sync orders to bling;', error)
          reject(error)
        }
      }
    })
  }
}
