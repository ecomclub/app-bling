'use strict'
const logger = require('console-files')

// bling client
const Bling = require('bling-erp-sdk')

// read configured E-Com Plus app data
const getConfig = require(process.cwd() + '/lib/store-api/get-config')

// mysql abstract
const database = require('../../lib/database')

// 
const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'

module.exports = (appSdk) => {
  return (req, res) => {
    const storeId = req.storeId
    /*
    Treat E-Com Plus trigger body here
    // https://developers.e-com.plus/docs/api/#/store/triggers/
    */
    const trigger = req.body
    const orderId = trigger.resource_id

    // get app configured options
    getConfig({ appSdk, storeId }, true)

      .then(configObj => {
        /* Do the stuff */
        if (!configObj.bling_api_key) {
          const err = new Error('Token unset')
          err.name = SKIP_TRIGGER_NAME
          throw err
        }
        return configObj
      })

      .then(configObj => {
        return new Promise((resolve, reject) => {
          const query = 'SELECT * FROM ecomplus_orders WHERE order_ecom_id = ? AND order_store_id = ?'
          return database
            .pool
            .query(query, [orderId, storeId], (error, row) => {
              if (error) {
                const err = error
                err.name = SKIP_TRIGGER_NAME
                reject(err)
              } else if (!row || !row[0]) {
                const err = new Error('Order not found')
                err.name = SKIP_TRIGGER_NAME
                reject(err)
              } else if (row[0]) {
                resolve({ configObj })
              }
            })
        })
      })

      .then(({ configObj }) => {
        const url = `/orders/${orderId}.json`
        return appSdk
          .apiRequest(storeId, url)
          .then(resp => ({ data: resp.response.data, configObj }))
      })

      .then(({ data, configObj }) => {
        const blingClient = new Bling({ apiKey: configObj.bling_api_key })
        if (data.financial_status) {
          return blingClient
            .pedidos
            .getById(data.number)
            .then(resp => {
              let response
              try {
                response = JSON.parse(resp)
              } catch (error) {
                console.error('json parse error')
              }

              const { erros, pedidos } = response.retorno
              if (!erros && Array.isArray(pedidos) && pedidos[0] && pedidos[0].pedido) {
                const { pedido } = pedidos[0]
                const { current } = data.financial_status
                switch (current) {
                  case 'voided':
                    if (pedido.situacao.toLowerCase() === 'atendido' ||
                      pedido.situacao.toLowerCase() === 'venda agenciada' ||
                      pedido.situacao.toLowerCase() === 'em aberto') {
                      // cancela
                      return blingClient
                        .pedidos
                        .update(data.number, {
                          pedido: {
                            idSituacao: 12
                          }
                        })
                        .then(() => logger.log(`_ order ${data.number} status changed to cancelado | bling / #${storeId}`))
                    }
                    break
                  case 'paid':
                    // se tiver cancelado
                    // atualiza para atendido
                    if (pedido.situacao === 'Cancelado') {
                      // cancela
                      return blingClient
                        .pedidos
                        .update(data.number, {
                          pedido: {
                            idSituacao: 9
                          }
                        })
                        .then(() => logger.log(`_ order ${data.number} status changed to atendido | bling / #${storeId}`))
                    }
                    break
                  default: break
                }
              }
            })
        }
      })

      .then(() => res.send(ECHO_SUCCESS))

      .catch(err => {
        if (err.name === SKIP_TRIGGER_NAME) {
          // trigger ignored by app configuration
          res.send(ECHO_SKIP)
        } else {
          // logger.error(err)
          // request to Store API with error response
          // return error status code
          res.status(500)
          let { message } = err
          res.send({
            error: ECHO_API_ERROR,
            message
          })
        }
      })
  }
}
