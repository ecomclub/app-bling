'use strict'
const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'
let processQueue = []

module.exports = ({ appSdk, logger, blingClient, getConfig, database }) => {
  return (req, res) => {
    const storeId = req.storeId
    /*
    Treat E-Com Plus trigger body here
    // https://developers.e-com.plus/docs/api/#/store/triggers/
    */
    const trigger = req.body
    const orderId = trigger.resource_id

    if (processQueue.indexOf(orderId) !== -1) {
      return res.send(ECHO_SKIP)
    }

    processQueue.push(orderId)

    setTimeout(() => {
      // get app configured options
      getConfig({ appSdk, storeId }, true).then(configObj => {
        /* Do the stuff */
        if (!configObj.bling_api_key) {
          const err = new Error('Token unset')
          err.name = SKIP_TRIGGER_NAME
          throw err
        }

        return configObj
      }).then(async configObj => {
        let promise
        if (configObj.enabled_sync_others_status) {
          const url = `/orders/${(trigger.inserted_id || trigger.resource_id)}.json`
          const orderBody = await appSdk.apiRequest(storeId, url).then(({ response }) => response.data)
          const financialStatus = orderBody.financial_status ? orderBody.financial_status.current : null

          const query = 'SELECT * FROM ecomplus_orders ' +
            'where order_ecom_id = ? ' +
            'and order_store_id = ?'
          const values = [orderId, storeId]
          if (trigger.action === 'create' && orderBody.status !== 'cancelled') {
            promise = database.query(query, values).then(rows => {
              if (!rows || !rows.length) {
                // não existe, salva independente do financial_status
                return database.orders.save(storeId,
                  orderBody._id,
                  null,
                  configObj.bling_loja_id,
                  financialStatus,
                  parseEcomStatus(financialStatus)
                ).then(() => {
                  logger.log('Pedido salvo via webhook: ', orderBody.number,
                    'Store #:', storeId)
                })
              }

              return false
            })
          } else if (trigger.action === 'change' && trigger.fields && trigger.fields.includes('financial_status')) {
            promise = database.query(query, values).then(rows => {
              if (rows && rows.length && financialStatus) {
                // update statux?
                const apiKey = configObj.bling_api_key
                return blingClient({
                  url: `pedido/${orderBody.number}`,
                  method: 'get',
                  apiKey
                }).then(({ data }) => {
                  const { erros, pedidos } = data.retorno
                  if (!erros && Array.isArray(pedidos) && pedidos[0] && pedidos[0].pedido) {
                    const { pedido } = pedidos[0]
                    const { fields } = trigger

                    if ((fields && fields.includes('financial_status')) || (fields && fields.includes('fulfillment_status'))) {
                      // parse status
                      const { current } = orderBody.financial_status
                      let blingStatus = parseEcomStatus(current)

                      if (orderBody.fulfillment_status &&
                        orderBody.fulfillment_status.current &&
                        orderBody.fulfillment_status.current === 'shipped' &&
                        current === 'paid'
                      ) {
                        blingStatus = 'Atendido'
                      }

                      if (blingStatus && (blingStatus.toLowerCase() !== pedido.situacao.toLowerCase())) {
                        return blingClient({
                          url: `situacao/Vendas`,
                          method: 'get',
                          apiKey
                        })
                          .then(({ response }) => {
                            let situacoes = []
                            if (response && response.data && response.data.retorno) {
                              situacoes = response.data.retorno.situacoes
                            }

                            const situacao = situacoes.find(el => el.situacao.nome.toLowerCase() === blingStatus.toLowerCase())

                            if (situacao) {
                              const { id } = situacao.situacao
                              const update = {
                                pedido: {
                                  idSituacao: id
                                }
                              }

                              return blingClient({
                                url: `pedido/${orderBody.number}`,
                                method: 'put',
                                apiKey,
                                data: update
                              })
                            }

                            return false
                          })
                          .then(resp => {
                            if (resp) {
                              logger.log('Situação do pedido # alterada no Bling:', orderBody.number,
                                'Store #', storeId)
                            }
                          })
                      }

                    }
                  }
                })
              }
              return false
            })
          }
        }

        return promise
      }).then(() => res.send(ECHO_SUCCESS))
        .catch(err => {
          if (err.name === SKIP_TRIGGER_NAME) {
            // trigger ignored by app configuration
            return res.send(ECHO_SKIP)
          } else {
            // logger.error(err)
            // request to Store API with error response
            // return error status code
            logger.error('Erro com o webhook: ', err)
            res.status(500)
            let { message } = err
            res.send({
              error: ECHO_API_ERROR,
              message
            })
          }
        })

      processQueue.splice(processQueue.indexOf(orderId), 1)
    }, Math.random() * (5000 - 1000) + 1000)
  }
}

const parseEcomStatus = status => {
  switch (status) {
    case 'pending':
    case 'under_analysis':
    case 'authorized':
    case 'unauthorized':
    case 'partially_paid':
      return 'Em aberto'
    case 'paid':
      return 'Venda Agenciada'
    case 'in_dispute':
    case 'partially_refunded':
    case 'refunded':
    case 'voided':
      return 'Cancelado'
    case 'unknown': break
  }
}