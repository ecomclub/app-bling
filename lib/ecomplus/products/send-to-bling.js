'use strict'
// bling client
const Bling = require('bling-erp-sdk')

// logger
const logger = require('console-files')

// get app config
const getConfig = require('../../store-api/get-config')

// ecomClinet
const ecomClient = require('@ecomplus/client')

// mysql abstract
const database = require('../../database')

// get instances of stores
const getStores = require('../../get-stores')

// api schema
const { blingProductSchema } = require(process.cwd() + '/lib/schemas/products')

module.exports = appSdk => {
  logger.log('--> Rotina de envio de produtos para o bling está ativado')
  const sendProducts = () => new Promise(async (resolve, reject) => {
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

        getConfig({
          appSdk,
          storeId
        }, true)

          .then(async configObj => {
            if (configObj.bling_api_key) {
              return database
                .query('SELECT * FROM ecomplus_products WHERE product_store_id = ? AND error = ? AND product_bling_id IS NULL LIMIT 100', [storeId, 0, 0])
                .then(rows => {
                  if (rows && rows.length) {
                    return getConfig({ appSdk, storeId }, true)

                      .then(async configObj => {
                        if (configObj.bling_api_key) {
                          const bling = new Bling({
                            apiKey: configObj.bling_api_key,
                            lojaId: configObj.bling_loja_id
                          })

                          let currentProduct = 0

                          const recursiveSync = () => {
                            const nextProduct = () => {
                              currentProduct++
                              recursiveSync()
                            }

                            const product = rows[currentProduct]
                            let syncErrors = []
                            if (product) {
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
                                    logger.error('ParseBlingAddProductResponseErr', error)
                                  }

                                  const { erros, produtos } = response.retorno
                                  let sql
                                  if (!erros && Array.isArray(produtos) && produtos[0] && produtos[0][0] && produtos[0][0].produto) {
                                    logger.log(`[!] Produto enviado ao bling com sucesso | store ${storeId} | Produto ${data.sku}`)
                                    // links to a lojaId?
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
                                      bling.produtos.loja.add(body, produto.codigo).then(() => {
                                        logger.log(`[!] Produto vinculado a loja ${configObj.bling_loja_id} com sucesso | store ${storeId} | Produto ${data.sku}`)
                                      })
                                    }
                                    // atualiza o produto no banco de dados
                                    // se tiver tudo ok com a inserção no bling
                                    sql = 'UPDATE ecomplus_products SET product_bling_id = ? WHERE product_id = ?'
                                    database.query(sql, [produto.id, data._id])
                                    nextProduct()
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

                                    logger.log(`[!] Produto não enviado ao bling por erros em seu cadastro | Erro -> ${message} | store ${storeId} | Produto ${data.sku}`)
                                    // update like a error
                                    sql = 'UPDATE ecomplus_products SET error = ? WHERE product_id = ?'
                                    database.query(sql, [1, data._id])
                                    // push erro at array
                                    syncErrors.push({
                                      type: 'produtos',
                                      message,
                                      resource_id: product.product_id,
                                      sku: data.sku,
                                      date: new Date().toISOString()
                                    })
                                    nextProduct()
                                  }
                                })

                                .catch(error => {
                                  console.log(error.message)
                                  if (error.response && error.response.status >= 400) {
                                    setTimeout(() => {
                                      recursiveSync()
                                    }, 3000)
                                  } else {
                                    const { message } = error
                                    logger.log(`[!] Produto não enviado ao bling por erros em seu cadastro | Erro -> ${message} | store ${storeId} | Produto ${product.product_id}`)
                                    // update like a error
                                    let sql = 'UPDATE ecomplus_products SET error = ? WHERE product_id = ?'
                                    database.query(sql, [1, product.product_id])
                                    // push erro at array
                                    syncErrors.push({
                                      type: 'produtos',
                                      message,
                                      resource_id: product.product_id,
                                      date: new Date().toISOString()
                                    })
                                    nextProduct()
                                  }
                                })
                            } else {
                              // save log in application.hidden_data
                              if (syncErrors.length) {
                                // TODO
                              }
                              // next store
                              nextStore()
                            }
                          }
                          // start sync recursive
                          recursiveSync()
                        } else {
                          nextStore()
                        }
                      })

                      .catch(err => {
                        if (!err.appAuthRemoved && (!err.response || err.response.status !== 401)) {
                          logger.error('PRODUCTS_DB_TO_TINY_ERR', err)
                        }
                        nextStore()
                      })
                  } else {
                    nextStore()
                  }
                })
            } else {
              nextStore()
            }
          })

          .catch(err => {
            let message
            if (!err.appAuthRemoved && (!err.response || err.response.status !== 401)) {
              message = `Unexpected error ${err}`
            } else if (err.response && err.response.data) {
              message = JSON.stringify(err.response.data)
            } else if (err.response.status === 503) {
              message = `The store-api thinks we're going too fast. Let's wait a few seconds before calling the store again.`
            }
            logger.error('SendToBlingErr', message)
            nextStore()
          })
      } else {
        resolve()
      }
    }

    task()
  })

  const start = () => sendProducts()
    .finally(() => {
      const interval = (process.env.ECOM_SYNC_PRODUCTS_INTERVAL || 2) * 60 * 1000
      setTimeout(() => {
        start()
      }, interval)
    })

  // start after 30s
  setTimeout(start, 30000)
}
