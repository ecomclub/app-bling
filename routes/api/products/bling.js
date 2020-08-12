'use strict'
// salva produtos no db
// para serem sincronizados posteriormente
module.exports = ({ logger, ecomClient, database }) => {
  return (req, res) => {
    // parsed by middlewate in (./web.js)
    const { body, storeId, appConfig } = req
    const lojaId = appConfig.bling_loja_id
    const failed = []
    const sync = (current = 0) => {
      const nextProduct = () => {
        current++
        return sync(current)
      }

      if (!body[current]) {
        if (failed) {
          database.logger.error(failed).then(p => console.log('Erros salvos;', p))
        }

        return true
      }

      ecomClient.store({
        url: '/products.json?sku=' + body[current],
        storeId
      }).then(({ data }) => {
        const { result } = data
        if (!result || !result.length) {
          const err = new Error('Produto não encontrado na plataforma: ' + body[current])
          err.product_sku = body[current]
          err.code = 'notfound'
          throw err
        }

        const url = `/products/${result[0]._id}.json`
        return ecomClient.store({ url, storeId })
      }).then(({ data }) => {
        return database.products.get(data._id, storeId).then(row => ({ row, data }))
      }).then(({ data, row }) => {
        if (row && row.length) {
          // já existe no db
          return false
        }

        // save product
        return database
          .products
          .save(data.sku,
            data.name,
            data.price,
            data.quantity || 0,
            data.price,
            data.quantity || 0,
            storeId,
            lojaId,
            data._id)
          .then(() => data)
      }).then(data => {
        if (data) {
          logger.log('Produto salvo para proxima sincronização:', data.sku,
            'Store: ', storeId)
          // save variations?
          const { variations } = data
          if (variations && Array.isArray(variations) && variations.length) {
            const promises = []
            variations.forEach(variation => {
              if (variation.sku) {
                const promise = database
                  .variations
                  .save(variation.name, variation._id, variation.sku, data.sku, variation.quantity || 0, variation.quantity || 0, lojaId, storeId)
                promises.push(promise)
              } else {
                logger.log('Variação sem SKU: ', variation._id,
                  'Produto pai: sku;', data.sku,
                  'Variação não será sincronizada, favor enviar o produto novamente',
                  'StoreId:', storeId)
                failed.push({
                  message: `Variação sem SKU, produto salvo mas a variação não. Delete o produto pai (sku: ${data.sku}) antes de sincronizar novamente`,
                  resource_id: data._id,
                  store_id: storeId,
                  resource: 'products',
                  operation: 'Envio manual de produtos',
                  payload: JSON.stringify(variation)
                })
              }
            })

            return Promise.all(promises)
          }
        }

        return true
      }).then(() => nextProduct())
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

          failed.push({
            message,
            resource_id: body[current],
            store_id: storeId,
            resource: 'produtos (salvar produtos)',
            operation: 'Envio manual de produtos',
            payload: JSON.stringify(payload)
          })
          nextProduct()
        })
    }

    sync()
    return res.end()
  }
}
