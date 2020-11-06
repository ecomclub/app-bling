'use strict'
const newProduct = require('./../../lib/store-api/new-product')

module.exports = ({ appSdk, getConfig, logger, blingClient }) => async (req, res) => {
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

  const auth = await appSdk.getAuth(storeId)

  const sendToEcom = (produtoSku, apiKey) => blingClient({
    url: `produto/${produtoSku}`,
    method: 'get',
    apiKey
  }).then(({ data }) => {
    const { produtos } = data.retorno
    if (!produtos || !Array.isArray(produtos)) {
      const err = new Error(`Produto ${produtoSku} não encontrado no Bling`)
      err.name = 'ItemNotFound'
      return reject(err)
    }

    return produtos[0].produto
  })
    .then(produto => newProduct(produto, storeId, auth))
    .then(productBody => {
      return appSdk.apiRequest(storeId, '/products.json', 'POST', productBody, auth)
    }).then(({ response }) => {
      return {
        produto: produtoSku,
        _id: response.data._id,
        error: false
      }
    })
    .catch(e => {
      return {
        produto: produtoSku,
        _id: null,
        error: true
      }
    })

  return getConfig({ appSdk, storeId }, true).then(configObj => {
    if (!configObj || !configObj.bling_api_key) {
      res.status(401)
      return res.send({
        error: 'Unauthorized',
        message: 'Chave da api não configurada no aplicativo.'
      })
    }
    return configObj
  }).then(configObj => {
    res.end()
    const apiKey = configObj.bling_api_key
    const promises = []
    body.forEach(produtoId => {
      promises.push(sendToEcom(produtoId, apiKey))
    })

    return Promise.all(promises)
  }).then((result) => logger.log('Importação Bling', JSON.stringify({ result, storeId }, undefined, 2)))
    .catch(err => {
      logger.error('syncerr', err)
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
