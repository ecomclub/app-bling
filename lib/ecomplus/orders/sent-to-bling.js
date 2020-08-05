
'use strict'
// logger
const logger = require('console-files')

// ecomClinet
const ecomClient = require('@ecomplus/client')

// mysql abstract
const database = require('../../database')

// get instances of stores
const getStores = require('../../get-stores')

// bling client
const blingClient = require('./../../../lib/bling/client')

// get stores
const MapStores = require('./../../map-stores')

// api schema
const { blingOrderSchema } = require('./../../../lib/schemas/orders')

module.exports = appSdk => {
  logger.log('<< Synchronization of orders with Bling started.')
  const sync = () => new Promise(async (resolve, reject) => {
    let retry = 0
    const callback = (configObj, storeId, next, current, err) => {
      if (err && storeId) {
        return next()
      } else if (!next && !err && !storeId && !configObj) {
        return resolve()
      }

      if (!configObj.bling_api_key) {
        return next() // next store
      }

      const apiKey = configObj.bling_api_key

      const getOrders = () => {
        const sql = 'select * from ecomplus_orders ' +
          'where order_store_id = ? ' +
          'and error = ? ' +
          'and order_bling_id is null limit 20'
        return database.query(sql, [storeId, 0])
      }

      appSdk.getAuth(storeId).then(({ myId, accessToken }) => {
        let success = 0
        let syncErrors = []

        const doSync = (listOfOrders, index = 0) => {
          const nextOrder = () => {
            index++
            return doSync(listOfOrders, index)
          }

          if (!listOfOrders || !listOfOrders[index] || !listOfOrders[index].order_ecom_id) {
            let fn = null
            const lastSync = {
              sync: 'orders',
              date: new Date(),
              storeId,
              total: listOfOrders.length,
              success,
              errosCount: syncErrors.length
            }

            if (syncErrors.length) {
              lastSync.errors = syncErrors
              fn = () => require('./../../store-api/update-config')(appSdk, storeId, configObj.application_id)(lastSync)
            }

            if (listOfOrders.length) {
              logger.log('<< ', JSON.stringify(lastSync, undefined, 4))
            }

            syncErrors = []
            return next(fn)
          }

          const order = listOfOrders[index]
          const url = `/orders/${order.order_ecom_id}.json`
          ecomClient.store({
            url,
            storeId,
            authenticationId: myId,
            accessToken
          }).then(({ data }) => {
            const ecomOrder = data
            const blingSchema = blingOrderSchema(data)
            return { ecomOrder, blingSchema }
          }).then(({ ecomOrder, blingSchema }) => {
            return blingClient({
              url: 'pedido',
              method: 'post',
              apiKey,
              data: blingSchema
            }).then(({ data }) => ({ data, ecomOrder }))
          }).then(({ data, ecomOrder }) => {
            const { erros, pedidos } = data.retorno
            let sql
            if (!erros && (Array.isArray(pedidos) && pedidos[0] && pedidos[0].pedido)) {
              const { pedido } = pedidos[0]
              sql = 'UPDATE ecomplus_orders SET order_bling_id = ? WHERE order_ecom_id = ?'
              database.query(sql, [pedido.idPedido, ecomOrder._id])
              success++
              return nextOrder()
            } else {
              // save erro in log?
              let message
              if (Array.isArray(erros) && erros.length && erros[0] && erros[0].erro) {
                const { erro } = erros[0]
                message = erro.msg
              } else if (typeof erros === 'object' && erros.erro && erros.erro.msg) {
                const { erro } = erros
                message = erro.msg
              }

              // update like a error
              sql = 'UPDATE ecomplus_orders SET error = ? WHERE order_ecom_id = ?'
              database.query(sql, [1, ecomOrder._id])
              // push erro at array
              syncErrors.push({
                message,
                resource_id: order.order_ecom_id,
                number: ecomOrder.number,
                date: new Date().toISOString()
              })
              return nextOrder()
            }
          }).catch(error => {
            if (error.response && error.response.status >= 500) {
              if (retry <= 4) {
                setTimeout(() => {
                  sync(list, myId, accessToken)
                }, 3000)
                retry++
              } else {
                return nextOrder()
              }
            } else if (error.type) {
              const { message, type } = error
              switch (type) {
                case 'OrderAmountErr':
                case 'OrderBuyersErr':
                case 'OrderShippingLinesErr':
                case 'OrderItemsLinesErr':
                  syncErrors.push({
                    message,
                    resource_id: order.order_ecom_id,
                    date: new Date().toISOString()
                  })
                  const sql = 'UPDATE ecomplus_orders SET error = ? WHERE order_ecom_id = ?'
                  database.query(sql, [1, order.order_ecom_id])
                  return nextOrder()
                default: break
              }
            } else {
              const { message } = error
              // update like a error
              if (error.code !== 'ECONNABORTED') {
                const sql = 'UPDATE ecomplus_orders SET error = ? WHERE order_ecom_id = ?'
                database.query(sql, [1, order.order_ecom_id])
                // push erro at array
                syncErrors.push({
                  type: 'pedido',
                  message,
                  resource_id: order.order_ecom_id,
                  date: new Date().toISOString()
                })
              }
              return nextOrder()
            }
          })
        }

        return getOrders().then(doSync)
      }).catch((e) => {
        console.error('AuthErr', e)
        next() // next store
      })
    }

    const mp = new MapStores(appSdk)
    const stores = await getStores().catch(reject)
    mp.tasks(stores, callback)
  })

  const start = () => sync().finally(() => setTimeout(() => start(), 1 * 60 * 1000))
  // start after 30s
  setTimeout(() => start(), 1 * 30 * 1000)
  start()
}
