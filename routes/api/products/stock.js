module.exports = ({ appSdk, logger, blingClient, ecomClient, database }) => {
  return (req, res) => {
    // parsed by middlewate in (./web.js)
    const { body, storeId, appConfig } = req
    const apiKey = appConfig.bling_api_key

    const sync = (current = 0) => {
      const nextProduct = () => {
        current++
        return sync(current)
      }

      if (!body[current]) {
        return false
      }

      const config = {
        url: `/products.json?sku=${body[current]}`,
        storeId
      }

      ecomClient.store(config).then(({ data }) => {
        const { result } = data
        if (result.length) {
          const url = `/products/${result[0]._id}.json`
          return ecomClient.store({ url, storeId })
        }
        return false
      }).then(({ data }) => {
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
      }).then(payload => {
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
              logger.log('Quantidade do produto;', product.sku,
                'Atualizada para: ', data.quantity,
                'Store: ', storeId)
              return null
            })
          }
        }
        return false
      }).then(nextProduct)
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
            resource_id: body[current],
            store_id: storeId,
            resource: 'products/quantity',
            operation: 'Atualização de estoque (Bling>ECOM)',
            payload: JSON.stringify(payload) 
          }]).then(p => console.log('Erros salvos;', p))
          nextProduct()
        })
    }

    sync()
    return res.end()
  }
}
