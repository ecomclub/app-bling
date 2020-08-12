'use strict'

module.exports = ({ ecomClient, getStores, MapStores, database, appSdk, logger }) => {
  logger.log('>> Orders Manager - OK')

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
        !configObj.sync.ecom.orders ||
        configObj.sync.ecom.orders === false) {
        // next store
        return next()
      }

      appSdk.getAuth(storeId).then(({ myId, accessToken }) => {
        const fields = '_id,source_name,channel_id,number,code,status,financial_status,amount,payment_method_label,shipping_method_label,buyers,items,created_at,transactions'

        const fetchOrders = (limit = 500, offset = 0, success) => {
          const url = '/orders.json?financial_status.current=paid' +
            `&fields=${fields}` +
            `&limit=${limit}` +
            `&offset=${offset}`

          ecomClient.store({
            url,
            storeId,
            authenticationId: myId,
            accessToken
          }).then(({ data }) => {
            if (data.result && data.result.length) {
              const { result } = data
              const promises = []
              for (let i = 0; i < result.length; i++) {
                const promise = database.orders.get(result[i]._id, storeId).then(row => {
                  if (!row || !row.length) {
                    const order = result[i]
                    const status = (order.financial_status && order.financial_status.current) || null
                    return database
                      .orders
                      .save(storeId,
                        order._id,
                        null,
                        configObj.bling_loja_id,
                        status,
                        'Atendido').then(qry => {
                          success++
                          return qry
                        })
                  }

                  return false
                })

                promises.push(promise)
              }

              Promise.all(promises).then(done => {
                if (success > 0) {
                  console.log('Promises:', done)
                  logger.log(`>> Saved ${success} orders / #${storeId}`)
                }
                offset += limit
                fetchOrders(limit, offset, success)
              })
            }

            return true
          })
            .then(() => next())
            .catch(err => {
              const { response } = err
              if (response && response.status >= 500) {
                setTimeout(() => {
                  fetchOrders(limit, offset, success)
                }, 4000)
              } else {
                return next()
              }
            })
        }

        fetchOrders()
      })

        .catch(err => {
          if (err.response && err.response.status >= 500) {
            if (retry <= 4) {
              setTimeout(() => {
                current()
              }, 3000)
              retry++
            } else {
              next()
            }
          } else {
            logger.error('SaveOrderErr', err, 'storeId', storeId)
            next()
          }
        })
    }

    const mp = new MapStores(appSdk)
    const stores = await getStores().catch(reject)
    mp.tasks(stores, callback)
  })

  const start = () => save().finally(() => setTimeout(() => start(), 1 * 60 * 1000))
  // start after 30s
  setTimeout(() => start(), 1 * 30 * 1000)
  start()
}
