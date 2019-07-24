'use strict'
const Bling = require('bling-erp-sdk')
const mysql = require('./../database')

const { blingOrderSchema } = require(process.cwd() + '/lib/schemas/orders')

module.exports = (storeId, configObj) => {
  return (ecomplusOrders) => {
    const blingAPIKey = configObj.bling_api_key
    const blingLojaId = configObj.bling_loja_id || null
    // bling intance
    const bling = new Bling({
      apiKey: blingAPIKey,
      lojaId: blingLojaId
    })

    let schema = blingOrderSchema(ecomplusOrders)

    return bling.pedidos.add(schema)
      .then(pedido => {
        let orderBling = JSON.parse(pedido)
        let query = ` INSERT INTO ecomplus_orders
                      (order_store,order_ecom_id,order_bling_id,order_loja_id)
                      VALUES (?, ?, ?, ?)`
        let values = [
          storeId,
          ecomplusOrders._id,
          orderBling.retorno.pedidos[0].pedido.idPedido,
          blingLojaId
        ]
        return mysql.query(query, values)
      })
      .then(() => {
        return {
          status: 'success'
        }
      })
      .catch(e => {
        let err = JSON.parse(e.message)
        throw err
      })
  }
}
