'use strict'
const logger = require('console-files')
const sqlite = require('sqlite3').verbose()
const Bling = require('bling-erp-sdk')
const db = new sqlite.Database(process.env.ECOM_AUTH_DB)
const { ecomAuth } = require('ecomplus-app-sdk')
const { blingOrderSchema, ecomplusOrderSchema } = require('./schemas/orders')
const { blingProductSchema } = require('./schemas/products')
const mysql = require('./database')

/**
 * Verifica se a instalação do applicativo está completa a cada 3m
 * para registrar os triggers da applicação.
 */
const setup = () => {
  console.log('Verificando se existe procedure para ser registrado.')

  let query = 'SELECT application_id, store_id, authentication_id FROM bling_app_settings WHERE setted_up = ?'
  let index = 0

  db.each(query, [0], (erro, rows) => {
    setTimeout(async () => {
      if (erro) {
        // faz alguma coisa..
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
                          uri: 'https://echo-requests.herokuapp.com/' //'https://bling.ecomplus.biz/notifications'
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
                  })
              }
            })
            .catch(e => console.log(e))
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
  console.log('Verificando se existe sincronização pendente para o bling.')

  let query = 'SELECT store_id, authentication_id, application_id FROM bling_app_settings WHERE setted_up = ? AND store_synchronized = ?'
  let index = 0
  const sdk = await ecomAuth.then()

  if (!sdk) {
    throw new Error('SDK Ecomplus não configurado')
  }

  db.each(query, [1, 0], (erro, rows) => {
    setTimeout(async () => {
      if (erro) {
        // faz alguma coisa..
      } else {
        // busca autenticação do aplicativo
        const auth = await sdk.getAuth(rows.store_id, rows.authentication_id)
        //
        if (auth) {
          // busca data e hidden_data do aplicativo
          let app = await sdk.apiApp(rows.store_id, null, 'GET', null, auth)
          let appData = app.response.data.data || null

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
                    products = await sdk.apiRequest(storeId, '/products.json', 'GET').catch(e => console.log(e))
                  } else if (data.synchronize.products.byId && data.synchronize.products.byId.length > 0) {
                    // products = await Promise.all(data.synchronize.products.byId.map(product => sdk.apiRequest(storeId, '/products/' + product + '.json', 'GET')))
                    products = data.synchronize.products.byId
                  } else {
                    resolve(true)
                  }
                  console.log('Sincronizando %i produtos para o bling', products.response.data.result.length)
                  let stack = products.response.data.result.map(async product => {
                    sdk.apiRequest(storeId, '/products/' + product._id + '.json', 'GET')
                      .then(await insertProductAtDatabase)
                      .then(await insertProductAtBling)
                      .then(await insertProductAtBlingLoja)
                  })

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
                  .then(result => resolve(result))
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
                  // console.log('' + error)
                  //reject(error)
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
                  if (data.synchronize.orders.all && data.synchronize.orders.all === true) {
                    // busca todas a orders
                    let ordersPath = 'orders.json?fields=_id,source_name,channel_id,number,code,status,financial_status.updated_at,financial_status.current,fulfillment_status.updated_at,fulfillment_status.current,amount,payment_method_label,shipping_method_label,buyers._id,buyers.main_email,buyers.display_name,items.product_id,items.sku,items.name,items.quantity,items.price,created_at,updated_atorders.json?fields=_id,source_name,channel_id,number,code,status,shipping_lines,transactions,financial_status.updated_at,financial_status.current,fulfillment_status.updated_at,fulfillment_status.current,amount,payment_method_label,shipping_method_label,buyers,items.product_id,items.sku,items.name,items.quantity,items.price,created_at,updated_at'
                    let orders = await sdk.apiRequest(storeId, ordersPath, 'GET', null, null, auth).catch(e => console.log(e))
                    console.log('Sincronizando %i orders para o bling', orders.response.data.result.length)

                    let allOrders = orders.response.data.result.map((order, index) => {
                      setTimeout(async () => {
                        await bling.pedidos.add(blingOrderSchema(order))
                          .then(resp => {
                            let orderBling = JSON.parse(resp)
                            insertOrdersAtDatabase(order, orderBling, storeId)
                            // .then(r => console.log(r))
                          })
                          .catch(e => console.log('Erro com a order %i', index))
                      }, index * 100)
                    })
                    console.log(allOrders)
                    await Promise.all(allOrders).then(result => {
                      resolve({ application, sdk, storeId, result })
                    })
                  } else if (data.synchronize.orders.byId && data.synchronize.orders.byId.length > 0) {
                    // ..
                  } else {
                    resolve(true)
                  }
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
                  .catch(e => reject(e))
              })
            }


            // finaliza sincronização
            const storeSynchronized = ({ application, sdk, storeId }) => {
              console.log('Finalizando Sincroniações com sucesso.')
              return new Promise(resolve => {
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
                    console.log(err)
                  }
                  resolve({ application, sdk, storeId })
                })
              })
            }


            // verifica o que é pra ser importado para o bling
            if (appData.hasOwnProperty('synchronize')) {
              synchronizeProducts(app.response.data, sdk, rows.store_id)
                .then(await synchronizeOrders)
                .then(await storeSynchronized)
                .then(() => registerProceduresToStore(rows, blingLojaId))
                .catch(e => console.log(e))
            }
          } else {
            // bling apiKey ou bling lojaId não configurado
            // logger?
          }
        } else {
          // autentição não encontrada para storeId
          // logger?
        }
      }
    }, index * 1000)
  })
}

/**
 * 
 */
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

//
setInterval(setup, 1 * 60 * 1000)
setInterval(synchronization, 2 * 60 * 1000)