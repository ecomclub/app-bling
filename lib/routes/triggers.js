'use strict'
const { ecomAuth } = require('ecomplus-app-sdk')
const triggers = require('express').Router()
const mysql = require('../database')
const Bling = require('bling-erp-sdk')

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

  if (trigger.retorno.hasOwnProperty('estoques')) {
    updateProductAtEcomplus(trigger)
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
