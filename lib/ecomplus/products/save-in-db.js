'use strict'
// logger
const logger = require('console-files')

// ecomClinet
const ecomClient = require('@ecomplus/client')

// get stores
const getStores = require('./../../get-stores')

// get stores
const MapStores = require('./../../map-stores')

// database
const database = require('./../../database')

module.exports = async appSdk => {
  logger.log('--> Save Products')

  const save = () => new Promise((resolve, reject) => {
    getStores()
      .then(stores => {
        const mp = new MapStores(appSdk)
        mp.tasks(stores, function (configObj, storeId, next, current, err) {
          let retry = 0
          if ((!err && storeId)) {
            const { sync, unwatched } = configObj
            if (sync && sync.ecom && sync.ecom.products && sync.ecom.products === true) {
              ecomClient
                .store({ url: '/products.json', storeId })
                .then(({ data }) => {
                  const { result } = data
                  if (result && result.length) {
                    const promises = []
                    let count = 0
                    for (let i = 0; i < result.length; i++) {
                      if (!unwatched || unwatched.indexOf(result[i].slug) === -1) {
                        const lojaId = configObj.bling_loja_id
                        const url = `/products/${result[i]._id}.json`
                        const promise = ecomClient
                          .store({ url, storeId })
                          .then(({ data }) => {
                            return database
                              .products
                              .get(data._id, storeId)

                              .then(row => {
                                if (!row || !row.length) {
                                  // save product
                                  return database
                                    .products
                                    .save(data.sku, data.name, data.price, data.quantity || 0, data.price, data.quantity || 0, storeId, lojaId, data._id)
                                    .then(() => data)
                                }
                              })

                              .then(data => {
                                const { variations } = data
                                // save variations?
                                if (variations && Array.isArray(variations) && variations.length) {
                                  variations.forEach(variation => {
                                    if (variation.sku) {
                                      database
                                        .variations
                                        .save(variation.name || data.name, variation._id, variation.sku, data.sku, variation.quantity || 0, variation.quantity || 0, lojaId, storeId)
                                    } else {
                                      logger.log(`--> Variação ${variation._id} sem sku pra o produto ${data._id}, não salva no banco, será necessário sincronizar o produto manualmente`)
                                    }
                                  })
                                }
                                count++
                              })
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

                        promises.push(promise)
                      }
                    }

                    Promise.all(promises)
                      .then((r) => {
                        if (count > 0) {
                          logger.log(`Save ${count} products | #${storeId}`)
                        }
                        next()
                      })
                  }
                })
                .catch(e => console.error(e))
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

  const start = () => save().finally(() => {
    const interval = 5 * 60 * 1000
    setTimeout(() => {
      start()
    }, interval)
  })

  setTimeout(() => {
    start()
  }, 30 * 1000)
}
