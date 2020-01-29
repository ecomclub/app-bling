'use strict'
// logger
const logger = require('console-files')

// ecomClinet
const ecomClient = require('@ecomplus/client')

// database
const database = require('../../lib/database')

// read configured E-Com Plus app data
const getConfig = require(process.cwd() + '/lib/store-api/get-config')

module.exports = (appSdk) => {
  return (req, res) => {
    const storeId = parseInt(req.get('x-store-id'), 10) || req.query.storeId
    const { body } = req

    if (!storeId || storeId <= 100) {
      res.status(401)
      return res.send({
        error: 'Unauthorized',
        message: 'Store id não encontrado no header nem nos paramentros da url ou inválido.'
      })
    }

    if (!Array.isArray(body) || !body.length) {
      res.status(400)
      return res.send({
        error: 'bad format',
        message: 'Body precisa ser um array de sku`s'
      })
    }

    // get app configured options
    getConfig({ appSdk, storeId }, true)

      .then(configObj => {
        if (configObj.bling_api_key) {
          let current = 0
          const nextOrders = () => {
            current++
            recursive()
          }
          // sync recursive
          // to prevent 429 code or 503
          const recursive = () => {
            if (body[current]) {
              return appSdk
                .getAuth(storeId)

                .then(({ myId, accessToken }) => {
                  const fields = '_id,source_name,channel_id,number,code,status,financial_status,amount,payment_method_label,shipping_method_label,buyers,items,created_at,transactions'
                  const url = `/orders.json?number=${body[current]}&fields=${fields}`
                  return ecomClient
                    .store({
                      url,
                      storeId,
                      authenticationId: myId,
                      accessToken
                    })

                    .then(({ data }) => {
                      const { result } = data
                      if (result.length) {
                        database
                          .orders
                          .get(result[0]._id, storeId)
                          .then(row => {
                            if (!row || !row.length) {
                              const order = result[0]
                              return database
                                .orders
                                .save(storeId, order._id, null, configObj.bling_loja_id, null)
                                .then(() => logger.log(`Pedido ${order.number} salvo no banco e será enviado na proxima sincronização | store #${storeId}`))
                            }
                          })
                      } else {
                        nextOrders()
                      }
                    })
                })
            }
          }

          recursive()
        } else {
          res.status(401)
          res.send({
            error: 'Unauthorized',
            message: 'bling_api_key não configurada no aplicativo.'
          })
        }
      })

      .catch(err => {
        // logger.error(err)
        // request to Store API with error response
        // return error status code
        res.status(500)
        let { message } = err
        res.send({
          message
        })
      })
  }
}
