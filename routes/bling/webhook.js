'use strict'

const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'
const logger = require('console-files')
const Bling = require('bling-erp-sdk')
const { randomObjectId } = require('@ecomplus/utils')
const ecomClient = require('@ecomplus/client')
const processQueue = []

module.exports = (appSdk) => {
  return (req, res) => {
    const { storeId } = req.query
    let { data } = req.body
    if (!data) {
      return res.sendStatus(400)
    }
    logger.log(`Bling webhook #${storeId}`)

    // get app configured options
    getConfig({ appSdk, storeId }, true)
      .then(configObj => {
        if (configObj.bling_api_key) {
          const blingSettings = {
            apiKey: configObj.bling_api_key,
            lojaId: configObj.bling_loja_id
          }
          const bling = new Bling(blingSettings)

          if (typeof data === 'string') {
            try {
              data = JSON.parse(data)
            } catch (e) {
              // ignore invalid JSON
            }
          }
          if (!data || !data.retorno) {
            return res.sendStatus(400)
          }
          const { retorno } = data

          if (
            Array.isArray(retorno.estoques) &&
            retorno.estoques[0] &&
            configObj.sync &&
            configObj.sync.bling &&
            configObj.sync.bling.stock
          ) {
            // update product stock
            // ecomplus-api
            const trigger = retorno.estoques[0].estoque

            if (trigger) {
              logger.log(`Estoque #${storeId} ${trigger.codigo}`)
              bling.produtos.getById(trigger.codigo)
                .then(data => {
                  const result = JSON.parse(data)
                  const { produtos } = result.retorno
                  if (produtos && Array.isArray(produtos) && produtos[0] && produtos[0].produto) {
                    return produtos[0].produto
                  } else {
                    // todo
                  }
                })

                .then(produto => {
                  let sku
                  if (!produto.codigoPai) {
                    // produto
                    sku = produto.codigo
                  } else {
                    sku = produto.codigoPai
                  }

                  return ecomClient
                    .store({
                      url: `/products.json?sku=${sku}`,
                      storeId
                    })

                    .then(({ data }) => {
                      const { result } = data
                      if (result.length) {
                        const product = result.find(product => product.sku === sku)
                        let url = `/products/${product._id}.json`

                        return ecomClient
                          .store({ url, storeId })
                          .then(({ data }) => {
                            let promise
                            if (!produto.codigoPai) {
                              // produto
                              if (data.quantity !== produto.estoqueAtual) {
                                const body = {
                                  quantity: Math.sign(produto.estoqueAtual) === -1 ? 0 : produto.estoqueAtual
                                }
                                promise = appSdk.apiRequest(storeId, url, 'PATCH', body)
                              }
                            } else {
                              // variations
                              const variation = data.variations
                                .find(variation => variation.sku === produto.codigo)
                              if (variation) {
                                // variação existe na ecomplus
                                if (variation.quantity !== produto.estoqueAtual) {
                                  url = `/products/${product._id}/variations/${variation._id}.json`
                                  const body = {
                                    quantity: Math.sign(produto.estoqueAtual) === -1 ? 0 : produto.estoqueAtual
                                  }
                                  promise = appSdk.apiRequest(storeId, url, 'PATCH', body)
                                }
                              } else {
                                // variação nao existe
                                // inserir?
                                return bling
                                  .produtos
                                  .getById(sku)

                                  .then(resp => {
                                    const result = JSON.parse(resp)
                                    const { produtos } = result.retorno
                                    if (
                                      produtos &&
                                      Array.isArray(produtos) &&
                                      produtos[0] &&
                                      produtos[0].produto
                                    ) {
                                      return produtos[0].produto
                                    } else {
                                      // todo
                                    }
                                  })

                                  .then(produto => {
                                    const match = produto.variacoes
                                      .find(variacao => variacao.variacao.codigo === trigger.codigo)
                                    if (match) {
                                      const variacaoTipo = match.variacao.nome.split(':')[0]
                                      const variacaoNome = match.variacao.nome.split(':')[1]
                                      const body = {
                                        name: produto.descricao + ' / ' + variacaoNome,
                                        sku: trigger.codigo,
                                        quantity: match.variacao.estoqueAtual
                                      }
                                      body.specifications = {}
                                      body.specifications[variacaoTipo] = [
                                        {
                                          text: variacaoNome
                                        }
                                      ]

                                      url = `/products/${product._id}/variations.json`
                                      return appSdk.apiRequest(storeId, url, 'POST', body)
                                    }
                                  })
                              }
                            }
                            return promise.then(() => {
                              logger.log(`#${storeId} ${sku}: ${data.quantity} => ${produto.estoqueAtual}`)
                            })
                          })
                      } else {
                        const ecomplusProductSchema = require('./../../lib/schemas/ecomplus-products')
                        return bling
                          .produtos
                          .getById(sku)

                          .then(data => {
                            const result = JSON.parse(data)
                            const { produtos } = result.retorno
                            if (produtos && Array.isArray(produtos) && produtos[0] && produtos[0].produto) {
                              return produtos[0].produto
                            } else {
                              // todo
                            }
                          })

                          .then(produto => {
                            const body = ecomplusProductSchema(produto)
                            let resource = '/products.json'
                            return appSdk
                              .apiRequest(storeId, resource, 'POST', body)

                              .then(resp => {
                                if (!produto.codigoPai && produto.variacoes.length) {
                                  resource = `/products/${resp.response.data._id}/variations.json`
                                  produto.variacoes.forEach(variacao => {
                                    const variacaoTipo = variacao.variacao.nome.split(':')[0]
                                    const variacaoNome = variacao.variacao.nome.split(':')[1]
                                    const body = {
                                      name: produto.descricao + ' / ' + variacaoNome,
                                      sku: variacao.variacao.codigo,
                                      quantity: variacao.variacao.estoqueAtual
                                    }
                                    body.specifications = {}
                                    body.specifications[variacaoTipo] = [
                                      {
                                        text: variacaoNome
                                      }
                                    ]
                                    return appSdk.apiRequest(storeId, resource, 'POST', body)
                                  })
                                }
                              })
                          })
                      }
                    })
                })
            }
          } else if (retorno.pedidos) {
            const { sync } = configObj
            // update orders
            const trigger = retorno.pedidos[0].pedido
            let resource = `/orders.json?number=${trigger.numero}` +
              '&fields=_id,number,status,financial_status,fulfillment_status,shipping_lines' +
              ',buyers,items,hidden_metafields'
            const method = 'GET'

            if (processQueue.indexOf(trigger.numero) === -1 && sync && sync.bling) {
              setTimeout(() => {
                appSdk
                  .apiRequest(storeId, resource, method)
                  .then(resp => resp.response.data.result)
                  .then(result => {
                    const promises = []
                    const order = result[0]

                    if (order) {
                      if (trigger.nota && sync.bling.invoices) {
                        const promise = new Promise(resolve => {
                          // verifica se a nota ja existe na order
                          const shippingInvoices = order.shipping_lines.find(shippin => shippin.invoices)
                          let match
                          if (shippingInvoices) {
                            match = shippingInvoices.invoices
                              .find(invoice => invoice.number === trigger.nota.chaveAcesso)
                          }

                          if (!shippingInvoices || !match) {
                            const update = [
                              {
                                number: trigger.nota.numero,
                                serial_number: trigger.nota.numero,
                                access_key: trigger.nota.chaveAcesso
                              }
                            ]
                            resource = `/orders/${order._id}/shipping_lines/${order.shipping_lines[0]._id}.json`
                            appSdk.apiRequest(storeId, resource, 'PATCH', { invoices: update })
                          }
                          resolve()
                        })
                        promises.push(promise)
                      }

                      if (sync.bling.financial_status) {
                        const blingStatus = trigger.situacao.toLowerCase()
                        const current = parseStatus(blingStatus)
                        if (
                          current &&
                          (!order.financial_status || order.financial_status.current !== current)
                        ) {
                          const url = `/orders/${order._id}.json`
                          const updatedAt = new Date().toISOString()
                          const data = {
                            financial_status: {
                              updated_at: updatedAt,
                              current
                            }
                          }
                          if (
                            blingStatus === 'atendido' &&
                            (!order.fulfillment_status || order.fulfillment_status.current !== 'delivered')
                          ) {
                            data.fulfillment_status = {
                              updated_at: updatedAt,
                              current: 'shipped'
                            }
                          }
                          if (!order.hidden_metafields || order.hidden_metafields.length < 100) {
                            const metafield = {
                              _id: randomObjectId(),
                              namespace: 'bling',
                              field: 'order-status-sync',
                              value: `${blingStatus} => ${current} (${updatedAt})`
                            }
                            data.hidden_metafields = !order.hidden_metafields ? [metafield]
                              : order.hidden_metafields.concat([metafield])
                          }
                          promises.push(appSdk.apiRequest(storeId, url, 'PATCH', data))
                        }
                      }

                      if (sync.bling.shipping_lines) {
                        if (trigger.transporte && trigger.transporte.volumes && order.shipping_lines) {
                          const codes = []

                          trigger.transporte.volumes.forEach(volume => {
                            if (volume.volume && volume.volume.codigoRastreamento) {
                              codes.push({
                                codigo: volume.volume.codigoRastreamento,
                                tag: volume.volume.servico
                              })
                            }
                          })

                          if (codes.length) {
                            const updateCodes = []
                            codes.forEach(code => {
                              updateCodes.push({
                                code: code.codigo,
                                tag: code.tag.replace(' ', '').toLowerCase()
                              })
                            })
                            const resource = `/orders/${order._id}` +
                              `/shipping_lines/${order.shipping_lines[0]._id}.json`
                            const promise = appSdk.apiRequest(storeId, resource, 'PATCH', {
                              tracking_codes: updateCodes
                            })
                            promises.push(promise)
                          }
                        }
                      }
                    }

                    Promise.all(promises).then(() => {
                      logger.log(`Pedido ${trigger.numero} alterado via bling | store #${storeId}`)
                    }).catch(e => {
                      const err = new Error(`Erro ao atualizar o pedido ${trigger.numero} da loja ${storeId}`)
                      if (e.response && e.response.data) {
                        err.data = JSON.stringify(e.response.data)
                      }
                      logger.error(err)
                    })
                  })
                  .catch(e => logger.error('BlingUpdateErr', e))
                processQueue.splice(processQueue.indexOf(trigger.numero), 1)
              }, Math.random() * (5000 - 1000) + 1000)
            }
          }
        }
        // all done
        res.send(ECHO_SUCCESS)
      })

      .catch(err => {
        if (err.name === SKIP_TRIGGER_NAME) {
          // trigger ignored by app configuration
          res.send(ECHO_SKIP)
        } else {
          // logger.error(err)
          // request to Store API with error response
          // return error status code
          // se responder com erro a api para de se comunicar com o app

          res.status(200)
          const { message } = err
          res.send({
            error: ECHO_API_ERROR,
            message
          })
        }
      })
  }
}

const parseStatus = status => {
  switch (status) {
    case 'em aberto':
    case 'em andamento':
    case 'em digitação':
      return 'pending'
    case 'venda agenciada':
    case 'atendido':
      return 'paid'
    case 'cancelado':
      return 'voided'
  }
  return null
}
