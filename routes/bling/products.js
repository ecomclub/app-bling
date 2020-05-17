'use strict'
// logger
const logger = require('console-files')

// bling client
const Bling = require('bling-erp-sdk')

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
        if (!configObj || !configObj.bling_api_key) {
          res.status(401)
          return res.send({
            error: 'Unauthorized',
            message: 'bling_api_key não configurada no aplicativo.'
          })
        }
        return configObj
      })

      .then(configObj => {
        const blingSettings = {
          apiKey: configObj.bling_api_key,
          lojaId: configObj.bling_loja_id
        }

        const bling = new Bling(blingSettings)

        let current = 0
        const nextProduct = () => {
          current++
          sync()
        }

        const sync = () => {
          if (body[current]) {
            bling
              .produtos
              .getById(body[current])

              .then(data => {
                const result = JSON.parse(data)
                const { produtos } = result.retorno
                if (produtos && Array.isArray(produtos) && produtos[0] && produtos[0].produto) {
                  return produtos[0].produto
                } else {
                  // todo
                  logger.error(`Product ${body[current]} not found in bling`)
                }
              })

              .then(produto => {
                const schema = ecomplusProductSchema(produto)
                return appSdk
                  .apiRequest(storeId, '/products.json', 'POST', schema)
                  .then(resp => ({ data: resp.response.data, produto }))
              })

              .then(({ data, produto }) => {
                if (!produto.codigoPai && produto.variacoes && produto.variacoes.length) {
                  const resource = `/products/${data._id}/variations.json`
                  const { variacoes } = produto

                  variacoes.forEach(variacao => {
                    const pVariacao = variacao.variacao
                    const variations = pVariacao.nome.split(';')
                    const specifications = {}

                    // specifications
                    for (let i = 0; i < variations.length; i++) {
                      if (variations[i] !== '') {
                        const variation = variations[i].split(':')
                        const type = variation[0].trim().toLowerCase().replace(/[áâãà]/g, 'a').replace(/[éê]/g, 'e').replace(/[íî]/g, 'i').replace(/[óôõ]/g, 'o').replace(/[ú]/g, 'u').replace(/[ç]/g, 'c').replace(/-/g, '').replace(/\s/g, '-').replace(/[^0-9a-z-]/g, '')
                        const name = variation[1].trim()
                        specifications[type] = [{ text: name }]
                      }
                    }

                    const trimName = pVariacao.nome.replace(/;/g, ' / ')
                    const newVariation = {
                      name: `${produto.descricao} / ${trimName}`,
                      sku: pVariacao.codigo,
                      quantity: pVariacao.estoqueAtual,
                      specifications
                    }

                    appSdk
                      .apiRequest(storeId, resource, 'POST', newVariation)
                      .catch(e => {
                        logger.error(`Erro ao inserir nova variação no produto ${data._id} | Store ${storeId} | Erro: ${e}`)
                      })
                  })
                }
                // call next product
                nextProduct()
              })

              .catch(e => {
                const err = new Error(`SyncProductToEcomErr: ${e.message}`)
                err.storeId = storeId
                if (e.response && e.response.data) {
                  err.data = JSON.stringify(e.response.data)
                }
                err.current = body[current]
                logger.error(err)
                nextProduct()
              })
          }
        }

        sync()
        return res.end()
      })

      .catch(err => {
        // logger.error(err)
        // request to Store API with error response
        // return error status code
        res.status(500)
        const { message } = err
        res.send({
          message
        })
      })
  }
}
