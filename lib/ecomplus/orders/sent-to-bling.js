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
const { blingOrderSchema } = require('./../../../lib/schemas/orders')

module.exports = appSdk => {
  logger.log('--> Rotina de envio de pedidos para o bling está ativado')
  const sendOrders = () => new Promise(async (resolve, reject) => {
    let currentStore = 0
    const stores = await getStores()

    const task = () => {
      // ends the task if there no more stores in the array
      if (stores[currentStore] && stores[currentStore].store_id) {
        const store = stores[currentStore]
        const storeId = store.store_id
        let syncErrors = []
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
              return appSdk
                .getAuth(storeId)

                .then(({ myId, accessToken }) => {

                  return database
                    .query('SELECT * FROM ecomplus_orders WHERE order_store_id = ? AND error = ? AND order_bling_id IS NULL LIMIT 100', [storeId, 0])
                    .then(rows => {
                      if (rows && rows.length) {
                        return getConfig({ appSdk, storeId }, true)

                          .then(async configObj => {
                            if (configObj.bling_api_key) {
                              const bling = new Bling({
                                apiKey: configObj.bling_api_key,
                                lojaId: configObj.bling_loja_id
                              })

                              let currenOrder = 0

                              /**
                               * recursiveSync
                               */
                              const recursiveSync = () => {
                                const nextOrder = () => {
                                  currenOrder++
                                  recursiveSync()
                                }

                                const order = rows[currenOrder]
                                if (order) {
                                  const url = `/orders/${order.order_ecom_id}.json`
                                  return ecomClient
                                    .store({
                                      url,
                                      storeId,
                                      authenticationId: myId,
                                      accessToken
                                    })

                                    .then(({ data }) => {
                                      const blingSchema = blingOrderSchema(data)
                                      return { data, blingSchema }
                                    })

                                    .then(({ data, blingSchema }) => {
                                      return bling.pedidos.add(blingSchema).then(resp => ({ resp, data }))
                                    })

                                    .then(({ resp, data }) => {
                                      let response
                                      try {
                                        response = JSON.parse(resp)
                                      } catch (error) {
                                        logger.error('ParseBlingAddProductResponseErr', error)
                                      }

                                      const { erros, pedidos } = response.retorno
                                      let sql
                                      if (!erros && Array.isArray(pedidos) && pedidos[0] && pedidos[0].pedido) {
                                        logger.log(`[!] Pedido enviado ao bling com sucesso | store ${storeId} | Pedido ${data.number}`)
                                        // links to a lojaId?
                                        const { pedido } = pedidos[0]
                                        // atualiza o produto no banco de dados
                                        // se tiver tudo ok com a inserção no bling
                                        sql = 'UPDATE ecomplus_orders SET order_bling_id = ? WHERE order_ecom_id = ?'
                                        database.query(sql, [pedido.idPedido, data._id])
                                        nextOrder()
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

                                        logger.log(`[!] pedido não enviado ao bling por erros em seu cadastro | Erro -> ${message} | store ${storeId} | Produto ${data.sku}`)
                                        // update like a error
                                        sql = 'UPDATE ecomplus_orders SET error = ? WHERE order_ecom_id = ?'
                                        database.query(sql, [1, data._id])
                                        // push erro at array
                                        syncErrors.push({
                                          type: 'pedido',
                                          message,
                                          resource_id: order.order_ecom_id,
                                          number: data.number,
                                          date: new Date().toISOString()
                                        })
                                        nextOrder()
                                      }
                                    })

                                    .catch(error => {
                                      if (error.response && error.response.status >= 400) {
                                        setTimeout(() => {
                                          recursiveSync()
                                        }, 3000)
                                      } else if (error.type) {
                                        const { message, type } = error
                                        switch (type) {
                                          case 'OrderAmountErr':
                                          case 'OrderBuyersErr':
                                          case 'OrderShippingLinesErr':
                                          case 'OrderItemsLinesErr':
                                            syncErrors.push({
                                              type: 'pedido',
                                              message,
                                              resource_id: order.order_ecom_id,
                                              date: new Date().toISOString()
                                            })
                                            const sql = 'UPDATE ecomplus_orders SET error = ? WHERE order_ecom_id = ?'
                                            database.query(sql, [1, order.order_ecom_id])
                                            nextOrder()
                                            break
                                          default: break
                                        }
                                      } else {
                                        const { message } = error
                                        logger.log(`[!] pedido não enviado ao bling por erros em seu cadastro | Erro -> ${message} | store ${storeId} | Pedido ${order.order_ecom_id}`)
                                        // update like a error
                                        let sql = 'UPDATE ecomplus_orders SET error = ? WHERE order_ecom_id = ?'
                                        database.query(sql, [1, order.order_ecom_id])
                                        // push erro at array
                                        syncErrors.push({
                                          type: 'pedido',
                                          message,
                                          resource_id: order.order_ecom_id,
                                          date: new Date().toISOString()
                                        })
                                        nextOrder()
                                      }
                                    })
                                } else {
                                  // erro logs?
                                  // nextStore()
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
                              logger.error('ORDERS_DB_TO_TINY_ERR', err)
                            }
                            nextStore()
                          })
                      } else {
                        nextStore()
                      }
                    })
                })
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
            logger.error('SendToBlingErr', message)
            nextStore()
          })
      } else {
        resolve()
      }
    }

    task()
  })

  const start = () => sendOrders()
    .finally(() => {
      const interval = (process.env.ECOM_SYNC_ORDERS_INTERVAL || 2) * 60 * 1000
      setTimeout(() => {
        start()
      }, interval)
    })

  setTimeout(start, 60000)
}
