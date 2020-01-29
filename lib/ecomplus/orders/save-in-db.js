'use strict'
// logger
const logger = require('console-files')

// ecomClinet
const ecomClient = require('@ecomplus/client')

// get stores
const getStores = require('./../../get-stores')

// get app config
const getConfig = require('../../store-api/get-config')

// database
const database = require('./../../database')

module.exports = appSdk => {
  logger.log('--> Rotina para salvar pedidos no banco de dados está ativado.')

  const saveOrders = () => new Promise(async (resolve, reject) => {
    let currentStore = 0
    const stores = await getStores()

    const task = () => {
      // ends the task if there no more stores in the array
      if (stores[currentStore] && stores[currentStore].store_id) {
        const store = stores[currentStore]
        const storeId = store.store_id
        const nextStore = () => {
          currentStore++
          task()
        }

        getConfig({ appSdk, storeId }, true)

          .then(async configObj => {
            if (configObj.bling_api_key) {
              const {
                sync
              } = configObj

              if (sync &&
                sync.ecom &&
                sync.ecom.orders &&
                sync.ecom.orders === true
              ) {
                return appSdk
                  .getAuth(storeId)

                  .then(({ myId, accessToken }) => {
                    const fields = '_id,source_name,channel_id,number,code,status,financial_status,amount,payment_method_label,shipping_method_label,buyers,items,created_at,transactions'
                    const url = `/orders.json?fields=${fields}`
                    return ecomClient
                      .store({
                        url,
                        storeId,
                        authenticationId: myId,
                        accessToken
                      })

                      .then(({ data }) => {
                        const { result } = data
                        const promises = []
                        let count = 0
                        for (let i = 0; i < result.length; i++) {
                          const promise = database
                            .orders
                            .get(result[i]._id, storeId)
                            .then(row => {
                              if (!row || !row.length) {
                                const order = result[i]
                                return database
                                  .orders
                                  .save(storeId, order._id, null, configObj.bling_loja_id, null)
                                  .then(() => count++)
                              }
                            })

                          promises.push(promise)
                        }

                        Promise.all(promises).then(() => {
                          if (count > 0) {
                            logger.log(`${count} pedido(s) salvo no banco para a store #${storeId}`)
                          }
                          nextStore()
                        })
                      })
                  })
              } else {
                nextStore()
              }
            } else {
              nextStore()
            }
          })

          .catch(err => {
            let message
            console.error(err)
            if (!err.appAuthRemoved && (!err.response || err.response.status !== 401)) {
              message = 'Unexpected error'
            } else if (err.response && err.response.data) {
              message = JSON.stringify(err.response.data)
            } else if (err.response.status === 503) {
              message = `The store-api thinks we're going too fast. Let's wait a few seconds before calling the store again.`
            }
            logger.error('saveOrdersInDbErr', message)
            nextStore()
          })
      } else {
        resolve()
      }
    }

    task()
  })

  const start = () => saveOrders()
    .finally(() => {
      const interval = (process.env.ECOM_SYNC_PRODUCTS_INTERVAL || 2) * 60 * 1000
      setTimeout(() => {
        start()
      }, interval)
    })

  setTimeout(start, 50000)
}
