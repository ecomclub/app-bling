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
  logger.log('--> Rotina para salvar produtos no banco de dados está ativado.')

  const saveProducts = () => new Promise(async (resolve, reject) => {
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
                sync,
                unwatched
              } = configObj

              if (sync &&
                sync.ecom &&
                sync.ecom.products &&
                sync.ecom.products === true
              ) {
                //
                return ecomClient
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
                                    const { variations } = data
                                    // save product
                                    return database
                                      .products
                                      .save(data.sku, data.name, data.price, data.quantity || 0, data.price, data.quantity || 0, storeId, lojaId, data._id)
                                      .then(() => {
                                        // save variations?
                                        if (variations && Array.isArray(variations) && variations.length) {
                                          variations.forEach(variation => {
                                            if (variation.sku) {
                                              database
                                                .variations
                                                .save(variation.name, variation._id, variation.sku, data.sku, variation.quantity || 0, variation.quantity || 0, lojaId, storeId)
                                            } else {
                                              logger.log(`--> Variação ${variation._id} sem sku pra o produto ${data._id}, não salva no banco, será necessário sincronizar o produto manualmente`)
                                            }
                                          })
                                        }
                                        count++
                                      })
                                  }
                                })
                            })

                          promises.push(promise)
                        }
                      }
                      Promise.all(promises).then(() => {
                        if (count > 0) {
                          logger.log(`Salvo ${count} produtos no banco de dados para a loja #${storeId}`)
                        }
                        nextStore()
                      })
                    }
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
            if (!err.appAuthRemoved && (!err.response || err.response.status !== 401)) {
              message = 'Unexpected error'
            } else if (err.response && err.response.data) {
              message = JSON.stringify(err.response.data)
            } else if (err.response.status === 503) {
              message = `The store-api thinks we're going too fast. Let's wait a few seconds before calling the store again.`
            }
            logger.error('SaveProductsInDbErr', message)
            nextStore()
          })
      } else {
        resolve()
      }
    }

    task()
  })

  const start = () => saveProducts()
    .finally(() => {
      const interval = (process.env.ECOM_SYNC_PRODUCTS_INTERVAL || 2) * 60 * 1000
      setTimeout(() => {
        start()
      }, interval)
    })

  start()
}
