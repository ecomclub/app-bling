'use strict'
// logger
const logger = require('console-files')

// bling client
const blingClient = require('../../lib/bling/client')

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
        message: 'Missing store_id'
      })
    }

    if (!Array.isArray(body) || !body.length) {
      res.status(400)
      return res.send({
        error: 'bad format',
        message: 'Body must be a arrays of sku`s'
      })
    }

    // get app configured options
    getConfig({ appSdk, storeId }, true)

      .then(configObj => {
        if (!configObj || !configObj.bling_api_key) {
          res.status(401)
          return res.send({
            error: 'Unauthorized',
            message: 'Missing bling_api_key'
          })
        }
        return configObj
      })

      .then(configObj => {
        const apiKey = configObj.bling_api_key
        let current = 0
        const nextProduct = () => {
          current++
          return sync()
        }

        const sync = () => {
          if (body[current]) {
            blingClient({
              url: `produto/${body[current]}`,
              method: 'get',
              apiKey
            })
              .then(({ data }) => {
                const { produtos } = data.retorno
                if (produtos && Array.isArray(produtos) && produtos[0] && produtos[0].produto) {
                  return produtos[0].produto
                } else {
                  // todo
                  throw new Error(`Product ${body[current]} not found in bling`)
                }
              })

              .then(produto => {
                const schema = ecomplusProductSchema(produto)
                return appSdk
                  .apiRequest(storeId, '/products.json', 'POST', schema)
                  .then(({ response }) => ({ data: response.data, produto }))
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
                        const type = variation[0].trim()
                          .toLowerCase()
                          .replace(/[áâãà]/g, 'a')
                          .replace(/[éê]/g, 'e')
                          .replace(/[íî]/g, 'i')
                          .replace(/[óôõ]/g, 'o')
                          .replace(/[ú]/g, 'u')
                          .replace(/[ç]/g, 'c')
                          .replace(/-/g, '')
                          .replace(/\s/g, '-')
                          .replace(/[^0-9a-z-]/g, '')

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
                        logger.error(`Variations Erro: ${data._id} | ${storeId} | Erro: ${e}`)
                      })
                  })
                }
                // call next product
                return nextProduct()
              })

              .catch(e => {
                //console.log(e)
                const err = new Error('~<> Manual product synchronization failed')
                err.error = e.message
                err.storeId = storeId
                if (e.response && e.response.data) {
                  err.data = JSON.stringify(e.response.data)
                }
                err.product_sku = body[current]
                logger.error('~<> ProductSyncFailed', JSON.stringify(err, undefined, 4))
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
