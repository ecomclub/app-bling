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

module.exports = triggers
