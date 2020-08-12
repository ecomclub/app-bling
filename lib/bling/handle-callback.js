'use strict'

const logger = require('console-files')
const ecomClient = require('@ecomplus/client')
// bling client
const blingClient = require('../../lib/bling/client')

module.exports = (appSdk, storeId, apiKey, trigger, database) => {
  logger.log(`Estoque #${storeId} ${trigger.codigo}`)

  blingClient({
    url: `produto/${trigger.codigo}`,
    method: 'get',
    apiKey
  })
    .then(({ data }) => {
      const { produtos } = data.retorno
      if (produtos && Array.isArray(produtos) && produtos[0]) {
        return produtos[0].produto
      }
      return false
    })

    .then(produto => {
      if (produto) {
        return ecomClient.store({
          url: `/products.json?sku=${(produto.codigoPai || produto.codigo)}`,
          storeId
        }).then(({ data }) => {
          const { result } = data
          if (result.length) {
            const url = `/products/${result[0]._id}.json`
            return ecomClient.store({ url, storeId })
              .then(({ data }) => ({
                product: data,
                produto
              }))
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
            logger.log(`Estoque alterado #${storeId} / ${produto.codigo}: ${data.quantity}`)
            return null
          })
        }
      }
      return false
    })

    .catch(error => {
      const { message } = error
      const payload = {}
      if (error.response) {
        delete error.config.headers
        if (error.response.data) {
          payload.data = error.response.data
        }
        payload.status = error.response.status
        payload.config = error.config
      }

      database.logger.error([{
        message,
        resource_id: trigger.codigo,
        store_id: storeId,
        resource: 'products/quantity',
        operation: 'Atualização de estoque (Bling>ECOM)',
        payload: JSON.stringify(payload)
      }]).then(p => console.log('Erros salvos;', p))

      const err = new Error(`Erro no callback de estoque para #${storeId}`)
      err.original = payload
      logger.error(err)
    })
}
