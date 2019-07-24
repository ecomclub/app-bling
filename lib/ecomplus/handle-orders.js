'use strict'
const Bling = require('bling-erp-sdk')
const { blingOrderSchema } = require('./../schemas/orders')
const mysql = require('./../database')

module.exports = (appSdk) => {
  return async (triggerBody, configObj, storeId) => {
    console.log('-->[ECOMPLUS Handle Trigger][Orders]')
    const blingAPIKey = configObj.bling_api_key
    const blingLojaId = configObj.bling_loja_id || null

    if (!blingAPIKey) {
      throw new Error('Bling bling_api_key not found.')
    }

    const blingSettings = {
      apiKey: blingAPIKey,
      lojaId: blingLojaId
    }

    const bling = new Bling(blingSettings)

    const insert = (order) => {
      let schema = blingOrderSchema(order)
      return bling.pedidos
        .add(schema)
        .then(pedido => {
          let pedidoBling = JSON.parse(pedido)
          let query = ` INSERT INTO ecomplus_orders
                          (order_store,order_ecom_id,order_bling_id,order_loja_id)
                          VALUES (?, ?, ?, ?)`
          let values = [
            storeId,
            order._id,
            pedidoBling.retorno.pedidos[0].pedido.idPedido,
            blingLojaId
          ]
          return mysql.query(query, values)
        })
        .catch(e => {
          /* Save log */
          /* ... */
        })
    }

    const update = (order) => {
      return bling.pedidos.getById(5919)
        .then(result => {
          let resp = JSON.parse(result)
          let pedido = resp.retorno.pedidos[0].pedido
          if (statusToBling(order.financial_status.current) !== pedido.situacao) {
            let body = {
              pedido: {
                idSituacao: situacaoCode(order.financial_status.current)
              }
            }
            return bling.pedidos.update(5919, body)
          }
        })
    }

    try {
      let subresource = triggerBody.subresource || null
      let insertedId = triggerBody.inserted_id || null
      let action = triggerBody.action

      let resourceId = subresource && triggerBody.resource_id ? triggerBody.resource_id : insertedId
      let apiResource = `/orders/${resourceId}.json`
      let request = await appSdk.apiRequest(storeId, apiResource, 'GET')

      let { data } = request.response

      // new product
      if (insertedId && action === 'create' && !subresource) {
        insert(data)
      }

      // update bling.pedido.situacao
      if (action === 'create' && subresource === 'payments_history') {
        update(data)
      }
    } catch (error) {
      throw error
    }

    Promise.resolve()
  }
}

const statusToBling = (status) => {
  switch (status) {
    case 'pending':
    case 'under_analysis':
    case 'unknown':
    case 'partially_paid':
    case 'authorized':
      return 'Em aberto'
    case 'paid':
      return 'Atendido'
    case 'voided':
    case 'refunded':
    case 'in_dispute':
    case 'partially_refunded':
      return 'Cancelado'
    default: return ''
  }
}

const statusToEcomplus = (status) => {
  switch (status) {
    case 'Em aberto':
    case 'Em andamento':
    case 'Em digitação':
      return 'pending'
    case 'Venda agenciada':
    case 'Atendido':
      return 'paid'
    case 'Cancelado':
      return 'voided'
    default: return ''
  }
}

const situacaoCode = (situacao) => {
  switch (situacao) {
    case 'pending':
    case 'under_analysis':
    case 'unknown':
    case 'partially_paid':
    case 'authorized':
      return 6
    case 'paid':
      return 9
    case 'voided':
    case 'refunded':
    case 'in_dispute':
    case 'partially_refunded':
      return 12
    default: return 6
  }
}