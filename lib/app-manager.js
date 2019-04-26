'use strict'
const logger = require('console-files')
const sqlite = require('sqlite3').verbose()
const Bling = require('bling-erp-sdk')
const db = new sqlite.Database(process.env.ECOM_AUTH_DB)
const mysql = require('./database')
const { ecomAuth } = require('ecomplus-app-sdk')
const { blingOrderSchema } = require('./schemas/orders')
const { blingProductSchema } = require('./schemas/products')

db.run(`CREATE TABLE IF NOT EXISTS bling_app_settings (
  id                    INTEGER  PRIMARY KEY AUTOINCREMENT,
  created_at            DATETIME DEFAULT (CURRENT_TIMESTAMP) 
                                 NOT NULL,
  store_id              INTEGER  NOT NULL,
  authentication_id     STRING   UNIQUE,
  application_id        INTEGER  NOT NULL,
  setted_up             INTEGER  DEFAULT (0),
  setted_at             DATETIME,
  store_synchronized    INT      DEFAULT (0) 
                                 NOT NULL,
  store_synchronized_at DATETIME
);`)
/**
 * Verifica se a instalação do applicativo está completa a cada 3m
 * para registrar os triggers da applicação.
 */
const setup = () => {
  // debug
  console.log('Verificando se existe store para ser configurada.')
  logger.log('Verificando se existe store para ser configurada.')

  let query = 'SELECT application_id, store_id, authentication_id FROM bling_app_settings WHERE setted_up = ?'
  let index = 0

  db.each(query, [0], (erro, rows) => {
    setTimeout(async () => {
      if (erro) {
        // faz alguma coisa..
        console.log('Erro setup_query', erro)
        logger.log('Erro setup_query', erro)
      } else {
        ecomAuth.then(async sdk => {
          sdk.getAuth(rows.store_id, rows.authentication_id)
            .then(async auth => {
              // procedure só é registrado
              // se já houver access_token configurado
              if (auth.row.access_token && auth.row.authentication_id) {
                let params = {
                  title: 'Bling application setup',
                  triggers: [
                    {
                      resource: 'applications',
                      resource_id: auth.row.application_id
                    }
                  ],
                  webhooks: [
                    {
                      api: {
                        external_api: { // debug
                          uri: 'https://bling.ecomplus.biz/notifications'
                        }
                      },
                      method: 'POST',
                      send_body: true
                    }
                  ]
                }
                sdk.apiRequest(auth.row.store_id, '/procedures.json', 'POST', params, auth)
                  .then(() => {
                    let values = [
                      1,
                      auth.row.authentication_id,
                      rows.store_id,
                      auth.row.application_id
                    ]
                    let query = 'UPDATE bling_app_settings SET setted_up = ?, setted_at = CURRENT_TIMESTAMP WHERE authentication_id = ? AND store_id = ? AND application_id = ?'
                    db.run(query, values, erro => {
                      if (erro) {
                        // ... logger?
                      } else {
                        console.log('Application [%s] setted up.', auth.row.application_id)
                      }
                    })
                  })
                  .catch(e => {
                    console.log(e)
                    logger.log(e)
                  })
              }
            })
            .catch(e => {
              console.log(e)
              logger.log(e)
            })
        })
      }
    }, index * 1000)
  })
}

/**
 * verifica se a sincronização da store está configurada por completo
 * para enviar orders e products para o bling
 */

const synchronization = async () => {
  logger.log('Verificando se existe sincronização pendente para o bling.')

  let query = 'SELECT store_id, authentication_id, application_id FROM bling_app_settings WHERE setted_up = ? AND store_synchronized = ?'
  let index = 0
  const sdk = await ecomAuth.then()

  if (sdk) {
    db.each(query, [1, 0], (erro, rows) => {
      setTimeout(async () => {
        if (erro) {
          // faz alguma coisa..
          logger.error(erro)
        } else {
          // busca autenticação do aplicativo
          const auth = await sdk.getAuth(rows.store_id, rows.authentication_id)
          //
          if (auth) {
            // busca data e hidden_data do aplicativo
            let app = await sdk.apiApp(rows.store_id, null, 'GET', null, auth)

            // hidden_data configurado com chave e loja id ?
            if (app.response.data.hasOwnProperty('hidden_data') || app.response.data.hidden_data.bling_api_key || app.response.data.hidden_data.bling_loja_id) {
              const blingAPIKey = app.response.data.hidden_data.bling_api_key
              const blingLojaId = app.response.data.hidden_data.bling_loja_id
              // bling intance
              const bling = new Bling({
                apiKey: blingAPIKey,
                lojaId: blingLojaId
              })

              // sincroniza lista de produtos
              const synchronizeProducts = (application, sdk, storeId) => {
                return new Promise(async resolve => {
                  // o que é pra ser importado?
                  // produtos
                  let { data } = application
                  let products = []
                  if (data.synchronize.hasOwnProperty('products')) {
                    if (data.synchronize.products.all && data.synchronize.products.all === true) {
                      let allproducts = await sdk.apiRequest(storeId, '/products.json', 'GET').catch(e => console.log(e))
                      products = allproducts.response.data.result.map(product => product._id)
                    } else if (data.synchronize.products.byId && data.synchronize.products.byId.length > 0) {
                      products = data.synchronize.products.byId
                    } else {
                      resolve(true)
                    }
                    logger.log('Sincronizando %i produtos para o bling', products.length)
                    let stack = products.map(async product => {
                      sdk.apiRequest(storeId, '/products/' + (product._id || product) + '.json', 'GET')
                        .then(await insertProductAtDatabase)
                        .then(await insertProductAtBling)
                        .then(await insertProductAtBlingLoja)
                    })
                    console.log(products)
                    Promise.all(stack).then(result => {
                      resolve({ application, sdk, storeId, result })
                    }).catch(e => console.log(e))
                  } else {
                    resolve(true)
                  }
                })
              }

              // insere produto no banco de dados
              const insertProductAtDatabase = function (result) {
                let { data } = result.response
                return new Promise((resolve, reject) => {
                  let query = `INSERT INTO ecomplus_products
                    (product_sku,
                    product_name,
                    product_ecom_price,
                    product_ecom_stock,
                    product_bling_price,
                    product_bling_stock,
                    product_store_id,
                    product_loja_id,
                    product_id)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?,?)`
                  let values = [
                    data.sku,
                    data.name,
                    data.price || 0,
                    data.quantity || 0,
                    data.price || 0,
                    data.quantity || 0,
                    result.auth.row.store_id,
                    blingLojaId,
                    data._id
                  ]
                  mysql.query(query, values)
                    .then(() => {
                      // variação
                      if (data.hasOwnProperty('variations')) {
                        let variationsArray = data.variations.map(variation => {
                          return [
                            variation.name,
                            variation._id,
                            variation.sku,
                            data.sku,
                            blingLojaId,
                            result.auth.row.store_id
                          ]
                        })
                        if (variationsArray) {
                          let query = 'INSERT INTO ecomplus_products_variations (name,variation_id,variation_sku,parent_sku,lojaId,store_id) VALUES ?'
                          mysql.query(query, [variationsArray])
                            .then((err, result) => console.log('Variações inseridas ' + result.affectedRows, err))
                            .catch(e => console.log(e))
                        }
                      }
                      resolve(result)
                    })
                    .catch(e => reject(e))
                })
              }

              // insere produtos no bling
              const insertProductAtBling = async function (result) {
                let schema = blingProductSchema(result.response.data)
                return bling.produtos.add(schema)
              }

              // insere produto em determinada loja
              const insertProductAtBlingLoja = async (product) => {
                return new Promise((resolve, reject) => {
                  try {
                    let produtos = JSON.parse(product)
                    if (!produtos.retorno.erros) {
                      produtos.retorno.produtos[0].some(async produto => {
                        let produtoLojaBody = {
                          'produtoLoja': {
                            'idLojaVirtual': blingLojaId,
                            'preco': {
                              'preco': produto.produto.preco
                            }
                          }
                        }

                        let pro = await bling.produtos.loja.add(produtoLojaBody, produto.produto.codigo).catch(e => console.log('' + e))

                        if (pro) {
                          resolve(pro)
                        } else {
                          resolve(true)
                        }
                      })
                    }
                  } catch (error) {
                    logger.error('Erro insert_product_at_bling', error)
                    reject(error)
                  }
                })
              }

              // sincroniza orders com bling
              const synchronizeOrders = ({ application, sdk, storeId }) => {
                const promise = new Promise(async resolve => {
                  // orders?
                  let { data } = application

                  if (data.synchronize.hasOwnProperty('orders')) {
                    // todas?
                    let ordersToSynchronization = []
                    if (data.synchronize.orders.all && data.synchronize.orders.all === true) {
                      // busca todas a orders
                      let ordersPath = 'orders.json?fields=_id,source_name,channel_id,number,code,status,financial_status.updated_at,financial_status.current,fulfillment_status.updated_at,fulfillment_status.current,amount,payment_method_label,shipping_method_label,buyers._id,buyers.main_email,buyers.display_name,items.product_id,items.sku,items.name,items.quantity,items.price,created_at,updated_atorders.json?fields=_id,source_name,channel_id,number,code,status,shipping_lines,transactions,financial_status.updated_at,financial_status.current,fulfillment_status.updated_at,fulfillment_status.current,amount,payment_method_label,shipping_method_label,buyers,items.product_id,items.sku,items.name,items.quantity,items.price,created_at,updated_at'
                      let orders = await sdk.apiRequest(storeId, ordersPath, 'GET', null, null, auth).catch(e => console.log(e))
                      ordersToSynchronization = orders.response.data.result

                    } else if (data.synchronize.orders.byId && data.synchronize.orders.byId.length > 0) {
                      console.log('Orders by Id')
                      let orderById = data.synchronize.orders.byId.map(async order => {
                        let result = await sdk.apiRequest(storeId, '/orders/' + order + '.json', 'GET', null, null, auth)
                          .catch(e => console.log(e))
                        return result.response.data
                      })
                      ordersToSynchronization = await Promise.all(orderById)
                    } else {
                      resolve(true)
                    }

                    let allOrders = ordersToSynchronization.map((order, index) => {
                      setTimeout(async () => {
                        await bling.pedidos.add(blingOrderSchema(order))
                          .then(resp => {
                            let orderBling = JSON.parse(resp)
                            insertOrdersAtDatabase(order, orderBling, storeId)
                          })
                          .catch(e => console.log('Erro com a order %i', index))
                      }, index * 100)
                    })

                    await Promise.all(allOrders).then(result => {
                      resolve({ application, sdk, storeId, result })
                    })
                  }
                })
                return promise
              }

              // insere orders no banco de dados
              const insertOrdersAtDatabase = (orderEcom, orderBling, storeId) => {
                return new Promise((resolve, reject) => {
                  let query = ` INSERT INTO ecomplus_orders
                    (
                      order_store,
                      order_ecom_id,
                      order_bling_id,
                      order_loja_id
                    )
                    VALUES (?, ?, ?, ?)`
                  let values = [
                    storeId,
                    orderEcom._id,
                    orderBling.retorno.pedidos[0].pedido.idPedido,
                    blingLojaId
                  ]
                  mysql.query(query, values)
                    .then(result => resolve({ orderEcom, orderBling, storeId }))
                    .catch(e => {
                      logger.error('Erro insertOrdersAtDatabase', e)
                      reject(e)
                    })
                })
              }

              // finaliza sincronização
              const storeSynchronized = ({ application, sdk, storeId }) => {
                console.log('Finalizando Sincroniações com sucesso.')
                return new Promise((resolve, reject) => {
                  let sql = 'UPDATE bling_app_settings SET store_synchronized = ?, store_synchronized_at = CURRENT_TIMESTAMP ' +
                    'WHERE store_id = ? AND authentication_id = ? AND application_id = ?'
                  let values = [
                    1,
                    storeId,
                    auth.row.authentication_id,
                    auth.row.application_id
                  ]
                  db.run(sql, values, err => {
                    if (err) {
                      logger.error('Erro storeSynchronized', err)
                      reject(err)
                    }
                    resolve({ application, sdk, storeId })
                  })
                })
              }

              // verifica o que é pra ser importado para o bling
              if (app.response.data.hasOwnProperty('data') && app.response.data.data.hasOwnProperty('synchronize')) {
                synchronizeProducts(app.response.data, sdk, rows.store_id)
                  .then(await synchronizeOrders)
                  .then(await storeSynchronized)
                  .then(() => registerProceduresToStore(rows, blingLojaId))
                  .catch(e => {
                    logger.error('Erro synchronizeProducts', e)
                  })
              }
            } else {
              // bling apiKey ou bling lojaId não configurado
              logger.log('bling apiKey ou bling lojaId não configurado')
            }
          } else {
            // Autenticação não encontrada para storeId
            logger.log('Autenticação não encontrada para storeId')
          }
        }
      }, index * 1000)
    })
  } else {
    console.log('SDK Ecomplus não configurado')
    logger.log('SDK Ecomplus não configurado')
  }
}

const registerProceduresToStore = async (rows, lojaId) => {
  const promise = new Promise((resolve, reject) => {
    ecomAuth.then(async sdk => {
      sdk.getAuth(rows.store_id, rows.authentication_id)
        .then(async auth => {
          let params = {
            title: 'Bling Application Hooks',
            triggers: [
              {
                resource: 'products'
              },
              {
                resource: 'orders'
              }
            ],
            webhooks: [
              {
                api: {
                  external_api: { // debug
                    uri: 'https://bling.ecomplus.biz/triggers/ecomplus?lojaId=' + lojaId
                  }
                },
                method: 'POST',
                send_body: true
              }
            ]
          }
          sdk.apiRequest(auth.row.store_id, '/procedures.json', 'POST', params, auth)
            .then(() => console.log('Final'))
            .catch(e => { console.log(e) })
        })
        .catch(e => console.log(e))
    })
  })
  return promise
}
synchronization()
//setInterval(setup, 1 * 60 * 1000)
//setInterval(synchronization, 2 * 60 * 1000)
