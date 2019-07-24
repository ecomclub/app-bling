'use strict'
const logger = require('console-files')
const Bling = require('bling-erp-sdk')
const mysql = require('./../database')

const { blingProductSchema } = require(process.cwd() + '/lib/schemas/products')

module.exports = (storeId, configObj) => {
  return (ecomplusProducts) => {
    const { data } = ecomplusProducts.response

    const blingAPIKey = configObj.bling_api_key
    const blingLojaId = configObj.bling_loja_id || null
    // bling intance
    const bling = new Bling({
      apiKey: blingAPIKey,
      lojaId: blingLojaId
    })

    // database
    let query = `INSERT INTO ecomplus_products 
                (product_sku, product_name, product_ecom_price, product_ecom_stock, product_bling_price, product_bling_stock, product_store_id, product_loja_id, product_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?,?)`
    let values = [
      data.sku,
      data.name,
      data.price || 0,
      data.quantity || 0,
      data.price || 0,
      data.quantity || 0,
      storeId,
      blingLojaId,
      data._id
    ]

    let schema = blingProductSchema(data)
    return bling.produtos.add(schema)
      .then(productBling => {
        // vincula a uma loja
        // se configurado id da loja
        if (blingLojaId !== null) {
          try {
            let produtos = JSON.parse(productBling)
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
                return bling.produtos.loja.add(produtoLojaBody, produto.produto.codigo)
              })
            }
          } catch (error) {
            logger.error('[BLING INSERT PRODUCT_LOJA]', error)
          }
        }
      })
      .then(() => {
        return mysql.query(query, values)
          .then(() => {
            // insere variação
            if (data.hasOwnProperty('variations')) {
              let variationsArray = data.variations.map(variation => {
                return [
                  variation.name,
                  variation._id,
                  variation.sku,
                  data.sku,
                  variation.quantity || 0,
                  variation.quantity || 0,
                  blingLojaId,
                  storeId
                ]
              })
              if (variationsArray) {
                let query = 'INSERT INTO ecomplus_products_variations (name,variation_id,variation_sku,parent_sku,variation_stock_ecomplus,variation_stock_bling,lojaId,store_id) VALUES ?'
                return mysql.query(query, [variationsArray])
              }
            }
          })
      })
      .then(() => {
        return {
          status: 'success'
        }
      })
      .catch(e => {
        let err = JSON.parse(e.message)
        throw err
      })
  }
}
