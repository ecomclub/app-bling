'use strict'

module.exports = ({ appSdk, getConfig, logger, blingClient, ecomClient }) => {
  return (req, res) => {
    const storeId = parseInt(req.get('x-store-id') || req.query.store_id, 10)
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
        message: 'Body must be a array of sku`s'
      })
    }

    getConfig({ appSdk, storeId }, true)

      .then(configObj => {
        if (!configObj.bling_api_key) {
          res.status(401)
          return res.send({
            error: 'Unauthorized',
            message: 'bling_api_key não configurada no aplicativo.'
          })
        }

        const apiKey = configObj.bling_api_key

        const recursiveSync = (products, queue = 0) => {
          if (products[queue]) {
            ecomClient
              .store({
                url: `/products.json?sku=${products[queue]}`,
                storeId
              })
              .then(({ data }) => {
                const { result } = data
                if (result.length) {
                  const url = `/products/${result[0]._id}.json`
                  return ecomClient.store({ url, storeId })
                }
                return false
              })

              .then(({ data }) => {
                if (data) {
                  const product = data
                  return blingClient({
                    url: `produto/${data.sku}`,
                    method: 'get',
                    apiKey
                  })
                    .then(({ data }) => {
                      const { produtos } = data.retorno
                      if (produtos && Array.isArray(produtos) && produtos[0]) {
                        const { produto } = produtos[0]
                        return {
                          product,
                          produto
                        }
                      }
                      return false
                    })
                }
                return false
              })

              .then(payload => {
                if (payload) {
                  const { product, produto } = payload
                  let url
                  const data = {
                    quantity: produto.estoqueAtual > 0 ? produto.estoqueAtual : 0
                  }
                  if (product.sku === produto.codigo) {
                    if (product.quantity !== data.quantity) {
                      url = `/products/${product._id}.json`
                    }
                  } else if (product.variations) {
                    const variation = product.variations
                      .find(variation => variation.sku === produto.codigo)
                    if (variation && variation.quantity !== data.quantity) {
                      url = `/products/${product._id}/variations/${variation._id}.json`
                    }
                  }
                  if (url) {
                    return appSdk.apiRequest(storeId, url, 'PATCH', data).then(() => {
                      logger.log(`<< Estoque manual | atualizando plataforma | #${storeId} ${produto.codigo}: ${data.quantity}`)
                      return null
                    })
                  }
                }
                return false
              })

              .then(() => {
                queue++
                return recursiveSync(products, queue)
              })

              .catch(error => {
                console.log(error)
                const err = new Error(`Erro ao sincronizar estoque para #${storeId}`)
                err.original = error.message
                if (error.response) {
                  if (error.response.data) {
                    err.data = JSON.stringify(error.response.data)
                  }
                  err.status = error.response.status
                  err.config = error.config
                }
                logger.error(err)
                setTimeout(() => {
                  queue++
                  recursiveSync(products, queue)
                }, 4000);
              })
          }
        }

        return recursiveSync(body)
      })

      .then(() => res.send())
  }
}