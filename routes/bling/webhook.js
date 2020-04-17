'use strict'
const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'
const logger = require('console-files')
const Bling = require('bling-erp-sdk')
// ecomClinet
const ecomClient = require('@ecomplus/client')
let processQueue = []

module.exports = (appSdk) => {
  return (req, res) => {
    const { storeId } = req.query
    const { data } = req.body

    // get app configured options
    getConfig({ appSdk, storeId }, true)
      .then(configObj => {
        if (configObj.bling_api_key) {
          const blingSettings = {
            apiKey: configObj.bling_api_key,
            lojaId: configObj.bling_loja_id
          }

          const bling = new Bling(blingSettings)

          let body

          try {
            body = JSON.parse(data)
          } catch (err) {
            logger.error('ParseBodyErr', err)
          }
          const { retorno } = body
          if (retorno.estoques &&
            configObj.sync &&
            configObj.sync.bling &&
            configObj.sync.bling.stock &&
            configObj.sync.bling.stock === true
          ) {
            // update product stock
            // ecomplus-api
            const trigger = retorno.estoques[0].estoque

            return bling
              .produtos
              .getById(trigger.codigo)

              .then(data => {
                let result = JSON.parse(data)
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
                      let product = result.find(product => product.sku === sku)
                      let url = `/products/${product._id}.json`

                      return ecomClient
                        .store({ url, storeId })
                        .then(({ data }) => {
                          let promise
                          if (!produto.codigoPai) {
                            // produto
                            if (data.quantity !== produto.estoqueAtual) {
                              let body = {
                                quantity: Math.sign(produto.estoqueAtual) === -1 ? 0 : produto.estoqueAtual
                              }
                              promise = appSdk.apiRequest(storeId, url, 'PATCH', body)
                            }
                          } else {
                            // variations
                            let variation = data.variations.find(variation => variation.sku === produto.codigo)
                            if (variation) {
                              // variação existe na ecomplus
                              if (variation.quantity !== produto.estoqueAtual) {
                                url = `/products/${product._id}/variations/${variation._id}.json`
                                let body = {
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
                                  let result = JSON.parse(resp)
                                  const { produtos } = result.retorno
                                  if (produtos && Array.isArray(produtos) && produtos[0] && produtos[0].produto) {
                                    return produtos[0].produto
                                  } else {
                                    // todo
                                  }
                                })

                                .then(produto => {
                                  let match = produto.variacoes.find(variacao => variacao.variacao.codigo === trigger.codigo)
                                  if (match) {
                                    let variacaoTipo = match.variacao.nome.split(':')[0]
                                    let variacaoNome = match.variacao.nome.split(':')[1]
                                    let body = {
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
                          return promise.then(() => logger.log(`Estoque do produto ${sku} alterado de ${data.quantity} para ${produto.estoqueAtual}`))
                        })
                    } else {
                      const ecomplusProductSchema = require('./../../lib/schemas/ecomplus-products')
                      return bling
                        .produtos
                        .getById(sku)

                        .then(data => {
                          let result = JSON.parse(data)
                          const { produtos } = result.retorno
                          if (produtos && Array.isArray(produtos) && produtos[0] && produtos[0].produto) {
                            return produtos[0].produto
                          } else {
                            // todo
                          }
                        })

                        .then(produto => {
                          let body = ecomplusProductSchema(produto)
                          let resource = `/products.json`
                          return appSdk
                            .apiRequest(storeId, resource, 'POST', body)

                            .then(resp => {
                              if (!produto.codigoPai && produto.variacoes.length) {
                                resource = `/products/${resp.response.data._id}/variations.json`
                                produto.variacoes.forEach(variacao => {
                                  let variacaoTipo = variacao.variacao.nome.split(':')[0]
                                  let variacaoNome = variacao.variacao.nome.split(':')[1]
                                  let body = {
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
          } else if (retorno.pedidos) {
            const { sync } = configObj
            // update orders
            const trigger = retorno.pedidos[0].pedido
            let resource = `/orders.json?number=${trigger.numero}&fields=_id,number,status,financial_status,fulfillment_status,shipping_lines,buyers,items`
            let method = 'GET'

            if (processQueue.indexOf(trigger.numero) === -1) {
              setTimeout(() => {
                appSdk
                  .apiRequest(storeId, resource, method)
                  .then(resp => resp.response.data.result)
                  .then(result => {
                    let promises = []
                    let order = result[0]

                    // invoices?
                    if (trigger.nota &&
                      sync &&
                      sync.bling &&
                      sync.bling.invoices &&
                      sync.bling.invoices === true &&
                      (typeof order === 'object')
                    ) {
                      const promise = new Promise(resolve => {
                        // verifica se a nota ja existe na order
                        const shippingInvoices = order.shipping_lines.find(shippin => shippin.invoices)
                        let match
                        if (shippingInvoices) {
                          match = shippingInvoices.invoices.find(invoice => invoice.number === trigger.nota.chaveAcesso)
                        }

                        if (!shippingInvoices || !match) {
                          const update = [
                            {
                              number: data.nota.chaveAcesso,
                              serial_number: data.nota.numero,
                              access_key: data.nota.chaveAcesso
                            }
                          ]
                          resource = `/orders/${order._id}/shipping_lines/${order.shipping_lines[0]._id}.json`
                          appSdk.apiRequest(storeId, resource, 'PATCH', { invoices: update })
                        }
                        resolve()
                      })
                      promises.push(promise)
                    }

                    // update financial_status
                    if (sync &&
                      sync.bling &&
                      sync.bling.financial_status &&
                      sync.bling.financial_status === true
                    ) {
                      if ((order && !order.financial_status) || (order.financial_status.current !== parseStatus(trigger.situacao.toLowerCase()))) {
                        if (parseStatus(trigger.situacao) !== 'unknown') {
                          const update = {
                            financial_status: {
                              current: parseStatus(trigger.situacao)
                            }
                          }
                          const resource = `/orders/${order._id}.json`
                          const promise = appSdk.apiRequest(storeId, resource, 'PATCH', update)
                          promises.push(promise)
                        }
                      }
                    }

                    //
                    if (sync &&
                      sync.bling &&
                      sync.bling.shipping_lines &&
                      sync.bling.shipping_lines === true &&
                      (typeof order === 'object')
                    ) {
                      if (trigger.transporte && trigger.transporte.volumes && order.shipping_lines) {
                        let codes = []

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
                          const resource = `/orders/${order._id}/shipping_lines/${order.shipping_lines[0]._id}.json`
                          const promise = appSdk.apiRequest(storeId, resource, 'PATCH', { tracking_codes: updateCodes })
                          promises.push(promise)
                        }
                      }
                    }

                    Promise.all(promises).then(() => {
                      logger.log(`Pedido ${trigger.numero} alterado via bling | store #${storeId}`)
                    }).catch(e => {
                      if (e.response && e.response.data) {
                        logger.error(`Error ao atualizar o pedido ${trigger.numero} da loja ${storeId} | ${JSON.stringify(e.response.data)}`)
                      }
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
          let { message } = err
          res.send({
            error: ECHO_API_ERROR,
            message
          })
        }
      })
  }
}

const parseStatus = (status) => {
  switch (status) {
    case 'em aberto':
    case 'em andamento':
    case 'em digitação':
      return 'pending' // financial_status.current
    case 'venda agenciada':
    case 'atendido': // financial_status.current  
      return 'paid'
    case 'cancelado': // financial_status.current
      return 'voided'
  }
}
