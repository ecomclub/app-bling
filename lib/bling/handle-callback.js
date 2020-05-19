'use strict'

const logger = require('console-files')
const ecomClient = require('@ecomplus/client')

module.exports = (appSdk, storeId, bling, trigger) => {
  logger.log(`Estoque #${storeId} ${trigger.codigo}`)

  bling.produtos.getById(trigger.codigo)
    .then(data => {
      const result = JSON.parse(data)
      const { produtos } = result.retorno
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
            logger.log(`#${storeId} ${produto.codigo}: ${data.quantity}`)
            return null
          })
        }
      }
      return false
    })

    .catch(error => {
      const err = new Error(`Erro no callback de estoque para #${storeId}`)
      err.original = error.message
      if (error.response) {
        if (error.response.data) {
          err.data = JSON.stringify(error.response.data)
        }
        err.status = error.response.status
        err.config = error.config
      }
      logger.error(err)
    })
}
