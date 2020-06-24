'use strict'
// logger
const logger = require('console-files')

// ecomClinet
const ecomClient = require('@ecomplus/client')

// bling client
const blingClient = require('./../../../lib/bling/client')

// mysql abstract
const database = require('../../database')

// get instances of stores
const getStores = require('../../get-stores')

// get stores
const MapStores = require('./../../map-stores')

// api schema
const blingProductSchema = require(process.cwd() + '/lib/schemas/products')

module.exports = appSdk => {
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
      let syncErrors = []

      const query = 'select * from ecomplus_products where ' +
        'product_store_id = ? and ' +
        'error = ? and ' +
        'product_bling_id IS NULL LIMIT 100'

      const getProducts = () => database.query(query, [storeId, 0])

      const syncProducts = (list, queue = 0) => {
        const product = list[queue]
        const nextProduct = () => {
          queue++
          return syncProducts(list, queue)
        }

        if (!list || !product || !product.product_id) {
          // save erro
          // todo
          let fn = null
          const lastSync = {
            sync: 'products',
            date: new Date(),
            storeId,
            total: list.length,
            errosCount: syncErrors.length
          }

          if (syncErrors.length) {
            lastSync.errors = syncErrors
            fn = () => require('./../../store-api/update-config')(appSdk, storeId, configObj.application_id)(lastSync)
          }

          if (list.length) {
            logger.log('<< SYNC', JSON.stringify(lastSync, undefined, 4))
          }

          return next(fn)
        }

        const url = `/products/${product.product_id}.json`
        const apiKey = configObj.bling_api_key

        ecomClient
          .store({ url, storeId })

          .then(({ data }) => {
            const blingSchema = blingProductSchema(data)
            const ecomProduct = data
            return { ecomProduct, blingSchema }
          })

          .then(({ ecomProduct, blingSchema }) => {
            return blingClient({
              url: 'produto',
              method: 'post',
              apiKey,
              data: blingSchema
            }).then(({ data }) => ({ data, ecomProduct }))
          })

          .then(({ data, ecomProduct }) => {
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

              // save error
              syncErrors.push({
                type: 'products',
                message,
                resource_id: product.product_id,
                sku: ecomProduct.sku,
                date: new Date().toISOString()
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
            if (response && response.data) {
              console.error(JSON.stringify(response.data))
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
              const sql = 'UPDATE ecomplus_products SET error = ? WHERE product_id = ?'
              database.query(sql, [1, product.product_id])
              // push erro at array
              syncErrors.push({
                type: 'produtos',
                message,
                resource_id: product.product_id,
                date: new Date().toISOString()
              })
              return nextProduct()
            }
          })
      }

      getProducts()
        .then(list => {
          if (list && list.length) {
            logger.log(`<< Synchronizing ${list.length} products with bling | store #${storeId}`)
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

  const start = () => sync().finally(() => setTimeout(() => start(), 2 * 90 * 1000))
  // start after 30s
  //setTimeout(() => start(), 1 * 80 * 1000)
  start()
}