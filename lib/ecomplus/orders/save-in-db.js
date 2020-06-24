'use strict'
// logger
const logger = require('console-files')

// ecomClinet
const ecomClient = require('@ecomplus/client')

// get stores
const getStores = require('./../../get-stores')

const MapStores = require('./../../map-stores')

// database
const database = require('./../../database')

module.exports = appSdk => {
  logger.log('--> Save Orders')

  const save = () => new Promise((resolve, reject) => {
    getStores()
      .then(stores => {
        const mp = new MapStores(appSdk)
        mp.tasks(stores, function (configObj, storeId, next, current, err) {
          let retry = 0
          if ((!err && storeId)) {
            const { sync } = configObj
            if (sync && sync.ecom && sync.ecom.orders && sync.ecom.orders === true) {
              appSdk
                .getAuth(storeId)
                .then(({ myId, accessToken }) => {
                  let offset = 0
                  const limit = 500
                  const fields = '_id,source_name,channel_id,number,code,status,financial_status,amount,payment_method_label,shipping_method_label,buyers,items,created_at,transactions'

                  const fetchOrders = () => {
                    const url = `/orders.json?financial_status.current=paid&fields=${fields}&limit=${limit}&offset=${offset}`
                    ecomClient
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
                                const status = (order.financial_status && order.financial_status.current) || null
                                return database
                                  .orders
                                  .save(storeId, order._id, null, configObj.bling_loja_id, status, 'Atendido')
                                  .then(() => count++)
                              }
                            })

                          promises.push(promise)
                        }

                        Promise.all(promises).then(() => {
                          if (count > 0) {
                            logger.log(`<< Saved ${count} orders / #${storeId}`)
                          }
                          next()
                        })
                      })

                      .catch(err => {
                        const { response } = err
                        if (response && response.status >= 500) {
                          setTimeout(() => fetchOrders(), 2 * 2000)
                        }
                      })
                  }

                  fetchOrders()
                })

                .catch(err => {
                  if (err.response && err.response.status >= 500) {
                    if (retry <= 4) {
                      setTimeout(() => {
                        current()
                      }, 3000)
                      retry++
                    } else {
                      next()
                    }
                  } else {
                    next()
                  }
                })
            } else {
              next()
            }
          } else if (err && storeId) {
            return next()
          } else if (!next && !err && !storeId && !configObj) {
            resolve()
          }
        })
      })
      .catch(reject)
  })

  const start = () => save().finally(() => setTimeout(() => start(), 3 * 60 * 1000))
  // start after 30s
  setTimeout(() => start(), 1 * 1 * 1000)
}
