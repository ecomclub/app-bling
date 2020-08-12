'use strict'

module.exports = async ({ appSdk, ecomClient, getStores, MapStores, database, logger }) => {
  logger.log('<< Save Products - OK')

  const save = () => new Promise(async (resolve, reject) => {
    let retry = 0
    const callback = function (configObj, storeId, next, current, err) {
      if (err && storeId) {
        logger.error('MapstoreErr', err)
        return next()
      } else if (!next && !err && !storeId && !configObj) {
        return resolve()
      }

      if (!configObj.sync ||
        !configObj.sync.ecom ||
        !configObj.sync.ecom.products ||
        configObj.sync.ecom.products === false) {
        // next store
        return next()
      }

      let listOfErros = []

      ecomClient.store({
        url: '/products.json',
        storeId
      }).then(({ data }) => {
        const { result } = data
        const promises = []
        let success = 0
        const lojaId = configObj.bling_loja_id || null
        for (let i = 0; i < result.length; i++) {
          const url = `/products/${result[i]._id}.json`
          const promise = ecomClient.store({
            url,
            storeId
          }).then(({ data }) => {
            return database.products.get(data._id, storeId).then(rows => ({ rows, data }))
          }).then(({ rows, data }) => {
            if (!rows || !rows.length) {
              // save product
              return database
                .products
                .save(data.sku, data.name, data.price, data.quantity || 0, data.price, data.quantity || 0, storeId, lojaId, data._id)
                .then(() => {
                  success++
                  return data
                })
            }

            return false
          }).then(data => {
            if (data && data.variations && Array.isArray(data.variations) && data.variations.length) {
              const { variations } = data
              const requests = []
              variations.forEach(variation => {
                if (variation.sku) {
                  const req = database
                    .variations
                    .save(variation.name || data.name, variation._id, variation.sku, data.sku, variation.quantity || 0, variation.quantity || 0, lojaId, storeId)
                  requests.push(req)
                } else {
                  logger.log(`! Variação ${variation._id} sem sku pra o produto ${data._id}, não salva no banco, será necessário sincronizar o produto manualmente`)
                  listOfErros.push({
                    message: `Variação sem SKU, produto salvo mas a variação não. Delete o produto pai (sku: ${data.sku}) antes de sincronizar novamente`,
                    resource_id: data._id,
                    store_id: storeId,
                    resource: 'products',
                    operation: 'Salvar produto',
                    payload: JSON.stringify(variation)
                  })
                }
              })
              return Promise.all(requests)
            }
            return true
          })

          promises.push(promise)
        }

        return Promise.all(promises).then((r) => {
          if (success > 0) {
            logger.log('Produtos salvos:', success,
              '#Store:', storeId)
          }
          let postSync = null
          if (listOfErros.length) {
            postSync = database.logger.error(listOfErros).then(p => console.log('Erros da operação salvos', p))
          }
          return next(postSync)
        })
      }).catch(err => {
        if (err.response && err.response.status >= 500) {
          if (retry <= 4) {
            setTimeout(() => {
              return current()
            }, 3000)
            retry++
          } else {
            return next()
          }
        } else {
          return next()
        }
      })
    }

    const mp = new MapStores(appSdk)
    const stores = await getStores().catch(reject)
    mp.tasks(stores, callback)
  })

  const start = () => save().finally(() => setTimeout(() => start(), 1 * 30 * 1000))
  // start after 30s
  setTimeout(() => start(), 1 * 30 * 1000)
}
