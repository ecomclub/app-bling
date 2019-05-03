'use strict'
const logger = require('console-files')
const { blingProductSchema } = require(process.cwd() + '/lib/schemas/products')

module.exports = ({ mysql, Bling }) => {
  return (application, product) => {
    return new Promise((resolve, reject) => {
      console.log('[Bling] Inserindo produto', product.response.data._id)
      const blingAPIKey = application.hidden_data.bling_api_key
      const blingLojaId = application.hidden_data.bling_loja_id
      // bling intance
      const bling = new Bling({
        apiKey: blingAPIKey,
        lojaId: blingLojaId
      })

      // insere produto no banco de dados
      const insertProductAtDatabase = function (result) {
        let { data } = result.response
        return new Promise((resolve, reject) => {
          let query = `INSERT INTO ecomplus_products
                        (product_sku,
                        product_name,
                        product_ecom_price,
                        product_ecom_stock,
                        product_bling_price,
                        product_bling_stock,
                        product_store_id,
                        product_loja_id,
                        product_id)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?,?)`
          let values = [
            data.sku,
            data.name,
            data.price || 0,
            data.quantity || 0,
            data.price || 0,
            data.quantity || 0,
            result.auth.row.store_id,
            blingLojaId,
            data._id
          ]
          mysql.query(query, values)
            .then(() => {
              // variação
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
                    result.auth.row.store_id
                  ]
                })

                if (variationsArray) {
                  let query = 'INSERT INTO ecomplus_products_variations (name,variation_id,variation_sku,parent_sku,variation_stock_ecomplus,variation_stock_bling,lojaId,store_id) VALUES ?'
                  mysql.query(query, [variationsArray])
                    .then((result) => console.log('Variações inseridas ' + result.affectedRows))
                    .catch(e => console.log(e))
                }
              }
              resolve(result)
            })
            .catch(e => reject(e))
        })
      }

      // insere produtos no bling
      const insertProductAtBling = async function (result) {
        let schema = blingProductSchema(result.response.data)
        return bling.produtos.add(schema)
      }

      // vincula o produto a loja
      const insertProductAtBlingLoja = async (product) => {
        return new Promise((resolve, reject) => {
          try {
            let produtos = JSON.parse(product)
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
                await bling.produtos.loja.add(produtoLojaBody, produto.produto.codigo).then(resolve).catch(e => console.log(e))
              })
            }
            resolve()
          } catch (error) {
            logger.error('Erro insert_product_at_bling', error)
            reject(error)
          }
        })
      }

      insertProductAtDatabase(product)
        .then(insertProductAtBling)
        .then(insertProductAtBlingLoja)
        .then(resolve)
    })
  }
}
