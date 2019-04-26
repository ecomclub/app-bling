'use strict'
const { ecomAuth } = require('ecomplus-app-sdk')
const triggers = require('express').Router()
const mysql = require('../database')
const Bling = require('bling-erp-sdk')
const logger = require('console-files')

const { blingProductSchema } = require('../schemas/products')

/**
 * Recebe procedure do bling e atualiza estoque na ecom
 */
triggers.post('/bling', (request, response) => {
  // lojaId, storeId enviados via url, configurado no webhook no bling
  const {
    storeId,
    lojaId
  } = request.query

  let requestBody = request.body
  let { data } = requestBody
  logger.log(data)
  if (data == null) {
    return response.status(400).send({ error: 'no body in the request' })
  }

  if (!storeId || !lojaId) {
    return response.status(400).send({ error: 'storeId or lojaId not sent in the request' })
  }

  let trigger = JSON.parse(data)

  // sucesso/fim
  const end = () => {
    return response.status(204).end()
  }

  // throw
  const catchResponse = e => {
    console.log(e)
    logger.error(e) // debug
    return response.status(400).end()
  }

  // atualiza estoque do produto na ecom sempre que é atualizado no bling
  const updateProductAtEcomplus = (trigger) => {
    const promise = new Promise(async (resolve, reject) => {
      let sql = 'SELECT product_sku, product_bling_stock, product_id FROM ecomplus_products WHERE product_sku = ? AND product_store_id = ? AND product_loja_id = ?'
      let result = await mysql.query(sql, [trigger.retorno.estoques[0].estoque.codigo, storeId, lojaId]).catch(e => console.log(e))

      if (result) {
        if (result[0].product_bling_stock !== trigger.retorno.estoques[0].estoque.estoqueAtual) {
          // atualiza se os estoques foram diferentes
          // local
          let sql = 'UPDATE ecomplus_products SET product_bling_stock = ?, updated_at = CURRENT_TIMESTAMP() WHERE product_sku = ? AND product_store_id = ? AND product_loja_id = ?'
          mysql.query(sql, [trigger.retorno.estoques[0].estoque.estoqueAtual, trigger.retorno.estoques[0].estoque.codigo, storeId, lojaId])
            .then(async () => {
              // api
              const sdk = await ecomAuth.then()
              let resource = '/products/' + result[0].product_id + '.json'

              sdk.apiRequest(storeId, resource, 'PATCH', { quantity: trigger.retorno.estoques[0].estoque.estoqueAtual })
                .then(r => end())
                .catch(e => catchResponse(e))
            })
            .catch(e => catchResponse(e))
        }
      }
    })
    return promise
  }

  const updateOrderAtEcomplus = async (trigger) => {
    const sdk = await ecomAuth.then()

    const invoice = (trigger, order) => {
      return new Promise(async resolve => {
        // nota fiscal
        let result = {}
        if (trigger.retorno.pedidos[0].pedido.hasOwnProperty('nota')) {
          if (order.hasOwnProperty('shipping_lines')) {
            let invoices = order.shipping_lines.find(shippingLine => shippingLine.hasOwnProperty('invoices'))
            // tem nota na order?
            if (invoices) {
              // alguma chave bate com a do trigger?
              let invoiceMatch = invoices.invoices.find(invoice => invoice.number === trigger.retorno.pedidos[0].pedido.nota.chaveAcesso)
              //
              if (invoiceMatch) {
                resolve({ trigger, order, result })
              }
            }
            let update = {
              'invoices': [
                {
                  'number': trigger.retorno.pedidos[0].pedido.nota.chaveAcesso,
                  'serial_number': trigger.retorno.pedidos[0].pedido.nota.numero,
                  'access_key': trigger.retorno.pedidos[0].pedido.nota.chaveAcesso
                }
              ]
            }
            let resource = '/orders/' + order._id + '/shipping_lines/' + order.shipping_lines[0]._id + '.json'
            await sdk.apiRequest(storeId, resource, 'PATCH', update)
              .then(() => {
                resolve({ trigger, order, result })
              })
              .catch(e => catchResponse(e.response.data))
          }
        }
        // ok next
        resolve({ trigger, order, result })
      })
    }

    const financialStatus = ({ trigger, order, result }) => {
      return new Promise(async resolve => {
        if (!order.hasOwnProperty('financial_status') || order.financial_status.current !== parseStatus(trigger.retorno.pedidos[0].pedido.situacao)) {
          let update = {
            'financial_status': {
              'current': parseStatus(trigger.retorno.pedidos[0].pedido.situacao)
            }
          }
          let resource = '/orders/' + order._id + '.json'
          await sdk.apiRequest(storeId, resource, 'PATCH', update)
            .then(() => {
              resolve({ trigger, order, result })
            })
            .catch(e => catchResponse(e.response))
        }
        resolve({ trigger, order, result })
      })
    }

    const shippingLines = ({ trigger, order, result }) => {
      return new Promise(async resolve => {
        // verifica se a ordem possui o código de rastreio existente no pedido
        if (trigger.retorno.pedidos[0].pedido.transporte.hasOwnProperty('volumes')) {
          if (order.hasOwnProperty('shipping_lines')) {
            let trackingServices = order.shipping_lines.find(line => line.hasOwnProperty('tracking_codes'))
            let trackingCodes = trigger.retorno.pedidos[0].pedido.transporte.volumes.map(volume => {
              if (volume.volume.codigoRastreamento) {
                return {
                  'codigo': volume.volume.codigoRastreamento,
                  'tag': volume.volume.servico
                }
              }
            })
            // se a order ja tiver o código de restreio next
            if (trackingServices) {
              let trackingCodesOrder = trackingServices.find(tracking => trackingCodes.includes(tracking.code))
              if (trackingCodesOrder) {
                resolve({ trigger, order, result })
              }
            }

            // não tem insere o código no ratreio no shipping_lines

            let update = {
              'tracking_codes': trackingCodes.map(tracking => {
                return {
                  'code': tracking.codigo,
                  'tag': tracking.tag.replace(' ', '').toLowerCase()
                }
              })
            }
            let resource = '/orders/' + order._id + '/shipping_lines/' + order.shipping_lines[0]._id + '.json'
            await sdk.apiRequest(storeId, resource, 'PATCH', update)
              .then(() => {
                resolve({ trigger, order, result })
              })
              .catch(e => catchResponse(e.response.data))
          }
        }
      })
    }

    const parseStatus = (status) => {
      switch (status) {
        case 'Em Aberto':
          return 'pending' // financial_status.current
        case 'Em Andamento':
        case 'Em digitação':
          break
        case 'Venda agenciada':
        case 'Atendido': // financial_status.current
          return 'paid'
        case 'Cancelado': // financial_status.current
          return 'voided'
      }
    }

    let resource = '/orders.json?number=' + trigger.retorno.pedidos[0].pedido.numero + '&fields=_id,number,status,financial_status,fulfillment_status,shipping_lines,buyers,items'
    const order = await sdk.apiRequest(storeId, resource, 'GET').catch(e => catchResponse(e))

    if (order.response.data.result) {
      invoice(trigger, order.response.data.result[0])
        .then(financialStatus)
        .then(shippingLines)
        .then(() => end())
        .catch(e => catchResponse(e))
    }
  }

  if (trigger.retorno.hasOwnProperty('estoques')) {
    updateProductAtEcomplus(trigger)
  }

  if (trigger.retorno.hasOwnProperty('pedidos')) {
    updateOrderAtEcomplus(trigger)
  }
})

/**
 * Recebe procedures da ecomplus e atualiza o estoque no bling
 */
triggers.post('/ecomplus', (request, response) => {
  // lojaId, configurado no hidden_data e enviado como parametro
  const { lojaId } = request.query
  const requestBody = request.body

  // sucesso/fim
  const end = () => {
    return response.status(204).end()
  }

  // throw
  const catchResponse = e => {
    console.log(e)
    logger.error(e) // debug
    return response.status(400).end()
  }

  // verifica o trigger enviado pela api e atualiza o estoque no bling
  const updateProductAtBling = async trigger => {
    if (trigger.fields.includes('quantity')) {
      let sql = 'SELECT product_sku, product_ecom_stock, product_bling_stock, product_id FROM ecomplus_products WHERE product_store_id = ? AND product_loja_id = ? AND product_id = ?'
      let result = await mysql.query(sql, [trigger.store_id, lojaId, trigger.resource_id]).catch(e => console.log(e))

      // existe produto e a quantidade no trigger for diferente da quantidade no db
      if (result && (result[0].product_ecom_stock !== trigger.body.quantity)) {
        // procura o produto na api pra confirmar se o valor é o mesmo da notificação
        const sdk = await ecomAuth.then()
        let resource = '/products/' + result[0].product_id + '.json'

        sdk.apiRequest(trigger.store_id, resource, 'GET')
          .then(resp => {
            // se o valor local estiver diferente da api
            if (result[0].product_ecom_stock !== resp.response.data.quantity) {
              let sql = 'UPDATE ecomplus_products SET product_ecom_stock = ?, updated_at = CURRENT_TIMESTAMP() WHERE product_id = ? AND product_store_id = ? AND product_loja_id = ?'
              const values = [
                resp.response.data.quantity,
                result[0].product_id,
                trigger.store_id,
                lojaId
              ]

              // atualiza o estoque local com valor da api
              mysql.query(sql, values)
                .then(async () => {
                  // se o estoque do bling também estiver diferente atualizo também
                  if (result[0].product_bling_stock !== resp.response.data.quantity) {
                    // local
                    let sql = 'UPDATE ecomplus_products SET product_bling_stock = ?, updated_at = CURRENT_TIMESTAMP() WHERE product_id = ? AND product_store_id = ? AND product_loja_id = ?'
                    mysql.query(sql, values)
                      .then(async () => {
                        let app = await sdk.apiApp(trigger.store_id, null, 'GET')
                        const blingAPIKey = app.response.data.hidden_data.bling_api_key
                        const blingLojaId = app.response.data.hidden_data.bling_loja_id

                        const bling = new Bling({
                          apiKey: blingAPIKey,
                          lojaId: blingLojaId
                        })
                        let schema = blingProductSchema(resp.response.data)
                        // bling api
                        bling.produtos.update(schema, result[0].product_sku)
                          .then(r => end(r))
                          .catch(e => catchResponse(e))
                      })
                  }
                })
                .catch(e => catchResponse(e))
            }
          })
          .catch(e => catchResponse(e))
      }
    }
    end()
  }

  // todo
  const handleApplicationChange = async trigger => {
    // ...
    if (trigger.fields['hidden_data']) {

    }
    // ..
    if (trigger.fields['data']) {

    }
  }

  switch (requestBody.resource) {
    case 'products':
      updateProductAtBling(requestBody)
      break
    case 'applications':
      handleApplicationChange(requestBody)
      break
    default:
      break
  }
})

module.exports = triggers
