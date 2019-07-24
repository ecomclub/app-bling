'use strict'
const Bling = require('bling-erp-sdk')
const { blingProductSchema } = require('./../schemas/products')
const mysql = require('./../database')

module.exports = (appSdk) => {
  return async (trigger, configObj, storeId) => {
    console.log('-->[ECOMPLUS Handle Trigger][Products]')
    const blingAPIKey = configObj.bling_api_key
    const blingLojaId = configObj.bling_loja_id || null

    if (!blingAPIKey) {
      throw new Error('Bling bling_api_key not found.')
    }

    const bling = new Bling({
      apiKey: blingAPIKey,
      lojaId: blingLojaId
    })

    const insert = (data) => {
      const insertProduct = require('./bling/insert-product')(storeId, configObj)
      return insertProduct(data)
      // let schema = blingProductSchema(data)
      // return bling.produtos.add(schema)
    }

    const update = async (data) => {
      try {
        let result = await bling.produtos.getById(data.sku)
        let produto = JSON.parse(result)
        produto = produto.retorno.produtos[0].produto

        // verifico se ele tem estoqueAtual
        // se não tiver é porque é um produto base para variações no bling
        if (produto.hasOwnProperty('estoqueAtual')) {
          // compara quantity com o estoque atual
          // diferentes atualiza, igual permancem iguais kkk
          if (produto.estoqueAtual !== data.quantity) {
            let schema = blingProductSchema(data)
            return bling.produtos.add(schema)
          }
        } else if (!produto.hasOwnProperty('estoqueAtual') && (produto.hasOwnProperty('variacoes') && produto.variacoes.length)) {
          // tem variação?
          let variations = []
          data.variations.forEach(variation => {
            let match = produto.variacoes.find(variacao => variacao.variacao.codigo === variation.sku)
            if (!match) {
              // console.log('Variação', variation._id)
              variations.push(variation)
              // se a variação nao existir no bling
              // tambem salvo ela no banco de dados
              let values = [
                variation.name,
                variation._id,
                variation.sku,
                data.sku,
                variation.quantity || 0,
                variation.quantity || 0,
                blingLojaId,
                storeId
              ]
              let query = 'INSERT INTO ecomplus_products_variations (name,variation_id,variation_sku,parent_sku,variation_stock_ecomplus,variation_stock_bling,lojaId,store_id) VALUES (?,?,?,?,?,?,?,?)'
              return mysql.query(query, values)
            } else {
              let variationQtty = variation.quantity || 0
              if (match.variacao.estoqueAtual !== variationQtty) {
                variations.push(variation)
              }
            }
          })

          if (variations.length) {
            delete data.variations
            data.variations = variations
            let schema = blingProductSchema(data)
            return bling.produtos.add(schema)
          }
        } else {
          /** what???? */
        }
      } catch (error) {
        throw error
      }
    }

    try {
      let subresource = trigger.subresource || null
      let insertedId = trigger.inserted_id || null
      let action = trigger.action
      let resourceId = trigger.resource_id ? trigger.resource_id : insertedId
      //
      let apiPath = `/products/${resourceId}.json`
      let method = 'GET'
      let request = await appSdk.apiRequest(storeId, apiPath, method)
      let { data } = request.response

      // new product
      if (insertedId && action === 'create' && !subresource) {
        insert(data)
      }

      // update bling.pedido.situacao
      if ((action === 'change') && (trigger.fields.includes('quantity') || trigger.fields.includes('variations'))) {
        update(data)
      }
    } catch (error) {
      throw error
    }
  }
}
