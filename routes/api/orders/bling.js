'use strict'
// salva pedidos no db
// para serem sincronizados posteriormente
module.exports = ({ logger, appSdk, database, ecomClient }) => {
  return (req, res) => {
    // parsed by middlewate in (./web.js)
    const { body, storeId, appConfig } = req
    const lojaId = appConfig.bling_loja_id

    const sync = (current = 0) => {
      const nextOrders = () => {
        current++
        return sync(current)
      }

      if (!body[current]) {
        return false
      }

      return appSdk.getAuth(storeId).then(({ myId, accessToken }) => {
        const fields = '_id,source_name,channel_id,number,code,status,financial_status,amount,payment_method_label,shipping_method_label,buyers,items,created_at,transactions'
        const url = '/orders.json?number=' + body[current] +
          '&fields=' + fields
        return ecomClient
          .store({
            url,
            storeId,
            authenticationId: myId,
            accessToken
          })
      }).then(({ data }) => {
        const { result } = data
        if (!result || !result.length) {
          const err = new Error('Pedido não encontrado na plataforma: ' + body[current])
          err.product_sku = body[current]
          err.code = 'notfound'
          throw err
        }

        return database.orders.get(result[0]._id, storeId)
          .then(row => {
            // já existe, bye
            if (row && row.length) {
              return false
            }

            return { order: result[0] }
          })
      }).then(({ order }) => {
        if (order) {
          const status = (order.financial_status && order.financial_status.current) || null
          return database.orders.save(storeId, order._id, null, lojaId, status, 'Em Aberto')
            .then(() => logger.log('Pedido salvo: ', order.number,
              'Será sincronizado',
              'Store:', storeId))
        }

        return true
      }).then(nextOrders)
        .catch(err => {
          if (err.code !== 'notfound') {
            logger.error(err)
          }

          nextOrders()
        })
    }

    sync()
    return res.end()
  }
}
