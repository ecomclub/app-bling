'use strict'
// logger
const logger = require('console-files')

// bling client
const Bling = require('bling-erp-sdk')

// database
const database = require('../../lib/database')

// read configured E-Com Plus app data
const getConfig = require(process.cwd() + '/lib/store-api/get-config')

//
const ecomplusProductSchema = require('./../../lib/schemas/ecomplus-products')

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
          const blingSettings = {
            apiKey: configObj.bling_api_key,
            lojaId: configObj.bling_loja_id
          }

          const bling = new Bling(blingSettings)

          let current = 0
          const nextProduct = () => {
            current++
            recursive()
          }
          // sync recursive
          // to prevent 429 code or 503
          const recursive = () => {
            if (body[current]) {
              return bling
                .produtos
                .getById(body[current])

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
                  let schema = ecomplusProductSchema(produto)
                  let resource = `/products.json`
                  return appSdk
                    .apiRequest(storeId, resource, 'POST', schema)
                    .then(resp => resp.response.data)
                    .then(data => {
                      logger.log(`Produto ${body[current]} criado na store-api | store ${storeId}`)
                      if (!produto.codigoPai && produto.variacoes.length) {
                        resource = `/products/${data._id}/variations.json`
                        produto.variacoes.forEach(variacao => {
                          let variacaoTipo = variacao.variacao.nome.split(':')[0]
                          let variacaoNome = variacao.variacao.nome.split(':')[1]
                          let body = {
                            name: produto.descricao + ' / ' + variacaoNome,
                            sku: variacao.variacao.codigo,
                            quantity: variacao.variacao.estoqueAtual
                          }
                          body.specifications = {}
                          variacaoTipo = variacaoTipo.toLowerCase()
                            .replace(/[áâãà]/g, 'a')
                            .replace(/[éê]/g, 'e')
                            .replace(/[íî]/g, 'i')
                            .replace(/[óôõ]/g, 'o')
                            .replace(/[ú]/g, 'u')
                            .replace(/[ç]/g, 'c')
                            .replace(/-/g, '')
                            .replace(/\s/g, '-')
                            .replace(/[^0-9a-z-]/g, '')
                          body.specifications[variacaoTipo] = [
                            {
                              text: variacaoNome
                            }
                          ]

                          appSdk
                            .apiRequest(storeId, resource, 'POST', body)
                            .then(resp => resp.response.data)
                            .then(data => {
                              database
                                .variations
                                .save(body.name, data._id, body.sku, schema.sku, body.quantity || 0, body.quantity || 0, configObj.bling_loja_id, storeId)
                                .then(() => logger.log(`Variação ${data._id} do produto ${schema.sku} criado na store-api | store ${storeId}`))
                            })
                            .catch(e => {
                              console.log(e.response.data)
                              logger.error(`Erro ao inserir nova variação no produto ${data._id} | Store ${storeId} | Erro: ${e}`)
                            })
                        })
                      }

                      // salve in db
                      database
                        .products
                        .save(schema.sku, schema.name, schema.price, schema.quantity || 0, schema.price, schema.quantity || 0, storeId, configObj.bling_loja_id, data._id)
                        .then(() => {
                          let sql = 'UPDATE ecomplus_products SET product_bling_id = ? WHERE product_id = ?'
                          database.query(sql, [produto.id, data._id])
                        })
                      // call next product
                      nextProduct()
                    })
                })
                .catch(e => {
                  console.error(e)
                  let erro = 'Unexpected error'
                  if (e.response && e.response.data) {
                    erro = JSON.stringify(e.response.data)
                  }
                  logger.error('SyncProductToEcomErr', erro)
                  nextProduct()
                })
            }
          }

          recursive()
          res.end()
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
