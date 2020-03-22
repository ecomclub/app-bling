'use strict'
// bling client
const Bling = require('bling-erp-sdk')

// logger
const logger = require('console-files')

// ecomClinet
const ecomClient = require('@ecomplus/client')

// mysql abstract
const database = require('../../database')

// get instances of stores
const getStores = require('../../get-stores')

// get stores
const MapStores = require('./../../map-stores')

// api schema
const blingProductSchema = require(process.cwd() + '/lib/schemas/products')

module.exports = appSdk => {
  logger.log('--> Products to bling')

  const save = () => new Promise((resolve, reject) => {
    getStores()
      .then(stores => {
        const mp = new MapStores(appSdk)
        mp.tasks(stores, function (configObj, storeId, next, current, err) {
          let retry = 0
          if (!err && storeId) {
            if (!configObj.bling_api_key || !configObj.sync || !configObj.sync.ecom || !configObj.sync.ecom.products || configObj.sync.ecom.products !== true) {
              return next() // next store
            }

            const bling = new Bling({
              apiKey: configObj.bling_api_key,
              lojaId: configObj.bling_loja_id
            })

            let index = 0
            let success = 0
            let syncErrors = []

            const getProducts = () => database
              .query('SELECT * FROM ecomplus_products WHERE product_store_id = ? AND error = ? AND product_bling_id IS NULL LIMIT 100', [storeId, 0])

            const sync = (list) => {
              const nextProd = () => {
                index++
                return sync(list)
              }

              if (!list || !list[index] || !list[index].product_id) {
                let fn = null
                const lastSync = {
                  sync: 'products',
                  date: new Date(),
                  storeId,
                  total: list.length,
                  success,
                  errosCount: syncErrors.length
                }

                if (syncErrors.length) {
                  lastSync.errors = syncErrors
                  syncErrors = []
                  fn = () => require('./../../store-api/update-config')(appSdk, storeId, configObj.application_id)(lastSync)
                }

                if (list.length) {
                  delete lastSync.errors
                  logger.log('--> SYNC', JSON.stringify(lastSync, undefined, 4))
                }

                return next(fn)
              }

              const product = list[index]

              const url = `/products/${product.product_id}.json`

              ecomClient
                .store({ url, storeId })

                .then(({ data }) => {
                  const blingSchema = blingProductSchema(data)
                  return { data, blingSchema }
                })

                .then(({ data, blingSchema }) => {
                  return bling.produtos.add(blingSchema).then(resp => ({ resp, data }))
                })

                .then(({ resp, data }) => {
                  let response
                  try {
                    response = JSON.parse(resp)
                  } catch (error) {
                    return nextProd()
                  }

                  const { erros, produtos } = response.retorno
                  let sql

                  if (!erros && Array.isArray(produtos) && produtos[0] && produtos[0][0] && produtos[0][0].produto) {
                    const { produto } = produtos[0][0]
                    if (configObj.bling_loja_id) {
                      const body = {
                        produtoLoja: {
                          idLojaVirtual: parseInt(configObj.bling_loja_id),
                          preco: {
                            preco: produto.preco
                          }
                        }
                      }
                      bling.produtos.loja.add(body, produto.codigo)
                    }

                    sql = 'UPDATE ecomplus_products SET product_bling_id = ?, error = ? WHERE product_id = ?'
                    database.query(sql, [produto.id, 0, data._id])
                    success++
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
                    sql = 'UPDATE ecomplus_products SET error = ? WHERE product_id = ?'
                    database.query(sql, [1, data._id])
                    syncErrors.push({
                      type: 'products',
                      message,
                      resource_id: product.product_id,
                      sku: data.sku,
                      date: new Date().toISOString()
                    })
                  }
                  return nextProd()
                })

                .catch(error => {
                  if (error.response && error.response.status >= 500) {
                    if (retry <= 4) {
                      setTimeout(() => {
                        return current()
                      }, 3000)
                      retry++
                    } else {
                      return nextProd()
                    }
                  } else {
                    const { message } = error
                    // update like a error
                    const sql = 'UPDATE ecomplus_products SET error = ? WHERE product_id = ?'
                    database.query(sql, [1, product.product_id])
                    // push erro at array
                    syncErrors.push({
                      type: 'produtos',
                      message,
                      resource_id: product.product_id,
                      date: new Date().toISOString()
                    })
                    return nextProd()
                  }
                })
            }

            getProducts()
              .then(list => {
                if (list && list.length) {
                  logger.log(`--> Sending ${list.length} products to the bling | store #${storeId}`)
                }
                sync(list)
              })
              .catch(() => next())
          } else if (err && storeId) {
            return next()
          } else if (!next && !err && !storeId && !configObj) {
            resolve()
          }
        })
      })
      .catch(reject)
  })

  const start = () => save()
    .finally(() => {
      const interval = 3 * 60 * 1000
      setTimeout(() => {
        start()
      }, interval)
    })
  start()
  setTimeout(() => {
    //start()
  }, 60 * 1000)
}
