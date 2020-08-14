'use strict'

module.exports = ({ appSdk, getConfig, logger, database, ecomClient }) => {
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
          let current = 0
          const nextProduct = () => {
            current++
            recursive()
          }
          // sync recursive
          // to prevent 429 code or 503
          const recursive = () => {
            if (body[current]) {
              ecomClient
                .store({
                  url: `/products.json?sku=${body[current]}`,
                  storeId
                })
                .then(({ data }) => {
                  const { result } = data
                  if (result.length) {
                    const lojaId = configObj.bling_loja_id
                    const url = `/products/${result[0]._id}.json`
                    ecomClient
                      .store({ url, storeId })
                      .then(({ data }) => {
                        return database
                          .products
                          .get(data._id, storeId)
                          .then(row => {
                            if (!row || !row.length) {
                              const { variations } = data
                              // save product
                              return database
                                .products
                                .save(data.sku, data.name, data.price, data.quantity || 0, data.price, data.quantity || 0, storeId, lojaId, data._id)
                                .then(() => {
                                  logger.log(`Produto ${data.sku} salvo no banco de dados e será enviado ao tiny na proxima sincronização. | store #${storeId}`)
                                  // save variations?
                                  if (variations && Array.isArray(variations) && variations.length) {
                                    variations.forEach(variation => {
                                      if (variation.sku) {
                                        database
                                          .variations
                                          .save(variation.name, variation._id, variation.sku, data.sku, variation.quantity || 0, variation.quantity || 0, lojaId, storeId)
                                      } else {
                                        logger.log(`--> Variação ${variation._id} sem sku pra o produto ${data._id}, não salva no banco, será necessário sincronizar o produto manualmente`)
                                      }
                                    })
                                  }
                                  nextProduct()
                                })
                            } else {
                              nextProduct()
                            }
                          })
                      })
                  } else {
                    nextProduct()
                  }
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
