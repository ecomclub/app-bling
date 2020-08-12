'use strict'
// api schema
const newProduto = require('./../../../lib/bling/new-produto')

module.exports = ({ ecomClient, getStores, MapStores, database, appSdk, logger, blingClient }) => {
  logger.log('<< Synchronization of products with Bling started.')

  const sync = () => new Promise(async (resolve, reject) => {
    const stores = await getStores().catch(reject)

    const map = new MapStores(appSdk)

    const callback = (configObj, storeId, next, current, err) => {
      if (err && storeId) {
        logger.error('SyncProductErro', err)
        return next()
      } else if (!next && !err && !storeId && !configObj) {
        return resolve()
      }

      let retry = 0
      let listOfErros = []

      const query = 'select * from ecomplus_products where ' +
        'product_store_id = ? and ' +
        'error = ? and ' +
        'product_bling_id IS NULL LIMIT 20'

      const getProducts = () => database.query(query, [storeId, 0])

      const syncProducts = (list, queue = 0) => {
        const nextProduct = () => {
          queue++
          return syncProducts(list, queue)
        }

        if (!list || !list[queue] || !list[queue].product_id) {
          let fn = null

          if (listOfErros.length) {
            fn = () => database.logger.error(listOfErros).then(p => console.log('Erros salvos;', p))
          }

          return next(fn)
        }

        const product = list[queue]
        const url = `/products/${product.product_id}.json`
        const apiKey = configObj.bling_api_key

        ecomClient.store({ url, storeId }).then(({ data }) => {
          const blingSchema = newProduto(data, configObj)
          const ecomProduct = data
          return { ecomProduct, blingSchema }
        }).then(({ ecomProduct, blingSchema }) => {
          return blingClient({
            url: 'produto',
            method: 'post',
            apiKey,
            data: blingSchema
          }).then(({ data }) => ({ data, ecomProduct }))
        }).then(({ data, ecomProduct }) => {
          const { erros, produtos } = data.retorno
          let sql
          if (!erros &&
            Array.isArray(produtos) &&
            produtos[0] &&
            produtos[0][0] &&
            produtos[0][0].produto
          ) {
            const { produto } = produtos[0][0]
            // link to lojaId?
            const lojaId = configObj.bling_loja_id && configObj.bling_loja_id.trim()

            if (lojaId) {
              const body = {
                produtoLoja: {
                  idLojaVirtual: parseInt(lojaId),
                  preco: {
                    preco: produto.preco
                  }
                }
              }
              const url = `produtoLoja/${lojaId}/${produto.codigo}/json`
              blingClient({
                url,
                method: 'post',
                apiKey,
                data: body
              }).then(() => console.log('--> Produto vinculado a loja', produto.codigo, storeId))
            }

            // update db
            sql = 'update ecomplus_products set ' +
              'product_bling_id = ?, ' +
              'error = ? where ' +
              'product_id = ?'

            database.query(sql, [produto.id, 0, ecomProduct._id]).then(() => console.log('<< Produto enviado ', ecomProduct.sku))
          } else {
            let message
            if (Array.isArray(erros) &&
              erros.length &&
              erros[0] &&
              erros[0].erro
            ) {
              const { erro } = erros[0]
              message = erro.msg
            } else if (typeof erros === 'object' && erros.erro && erros.erro.msg) {
              const { erro } = erros
              message = erro.msg
            }
            // push erro at array
            listOfErros.push({
              message,
              resource_id: product.product_id,
              store_id: storeId,
              resource: 'products',
              operation: 'Envio de produtos',
              payload: JSON.stringify(erros)
            })

            // update product
            sql = 'UPDATE ecomplus_products SET ' +
              'error = ? WHERE ' +
              'product_id = ?'

            database.query(sql, [1, ecomProduct._id])
          }

          return nextProduct()
        })

          .catch(error => {
            console.error(error)
            const { response } = error
            let dataResponse
            if (response && response.data) {
              console.error(JSON.stringify(response.data))
              dataResponse = response.data
            }
            if (error.response && error.response.status >= 500) {
              if (retry <= 4) {
                setTimeout(() => {
                  return current()
                }, 3000)
                retry++
              } else {
                return nextProduct()
              }
            } else {
              const { message } = error
              // update like a error
              // timeout fodase
              if (error.code !== 'ECONNABORTED') {
                // todo
                const sql = 'UPDATE ecomplus_products SET error = ? WHERE product_id = ?'
                database.query(sql, [1, product.product_id])
                // push erro at array
                // push erro at array
                listOfErros.push({
                  message,
                  resource_id: product.product_id,
                  store_id: storeId,
                  resource: 'products',
                  operation: 'Envio de produto',
                  payload: JSON.stringify(error.response && error.response.data ? error.response.data : {})
                })
              }

              return nextProduct()
            }
          })
      }

      getProducts()
        .then(list => {
          if (list && list.length) {
            logger.log('Sincronizando produtos com bling:', list.length,
              'Store #', storeId)
          }
          return syncProducts(list)
        })
        .catch((e) => {
          console.log(e)
          return next()
        })
    }

    map.tasks(stores, callback)
  })

  const start = () => sync().finally(() => setTimeout(() => start(), 1 * 30 * 1000))
  // start after 30s
  setTimeout(() => start(), 1 * 30 * 1000)
}