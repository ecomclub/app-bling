'use strict'
const logger = require('console-files')
const { blingOrderSchema } = require(process.cwd() + '/lib/schemas/orders')

module.exports = ({ mysql, Bling }) => {
  return (application, order, storeId) => {
    return new Promise(async (resolve, reject) => {
      console.log('[Bling] Sincronizando order ', order._id)
      const blingAPIKey = application.hidden_data.bling_api_key
      const blingLojaId = application.hidden_data.bling_loja_id
      // bling intance
      const bling = new Bling({
        apiKey: blingAPIKey,
        lojaId: blingLojaId
      })

      // insere orders no banco de dados
      const insertOrdersAtDatabase = (orderEcom, orderBling, storeId) => {
        return new Promise((resolve, reject) => {
          let query = ` INSERT INTO ecomplus_orders
                          (
                            order_store,
                            order_ecom_id,
                            order_bling_id,
                            order_loja_id
                          )
                          VALUES (?, ?, ?, ?)`
          let values = [
            storeId,
            orderEcom._id,
            orderBling.retorno.pedidos[0].pedido.idPedido,
            blingLojaId
          ]
          mysql.query(query, values)
            .then(result => resolve({ orderEcom, orderBling, storeId }))
            .catch(e => {
              logger.error('Erro insertOrdersAtDatabase', e)
              reject(e)
            })
        })
      }

      let schemaBling = blingOrderSchema(order)
      await bling.pedidos.add(schemaBling)
        .then(result => {
          let resultParse = JSON.parse(result)
          insertOrdersAtDatabase(order, resultParse, storeId)
            .then(resolve)
        })
        .catch(reject)
    })
  }
}
