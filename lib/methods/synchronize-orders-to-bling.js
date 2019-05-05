'use strict'

module.exports = ({ ecomAuth, mysql, Bling }) => {
  return (storeId) => {
    return new Promise(async (resolve, reject) => {
      const sdk = await ecomAuth.then()
      const auth = await sdk.getAuth(storeId)
      // checa configurações do aplicativo
      // para verificar se é possível realizar a sincronização
      // dos produtos para o bling
      sdk.apiApp(storeId, null, 'GET')
        .then(async resp => {
          let application = resp.response.data
          // se o order não forem configurados
          // para sincronização next..
          if (!application.hasOwnProperty('data') ||
            !application.data.hasOwnProperty('synchronize') ||
            (application.data.hasOwnProperty('synchronize') &&
              !application.data.synchronize.hasOwnProperty('ecomplus')) ||
            (application.data.synchronize.hasOwnProperty('ecomplus') &&
              !application.data.synchronize.ecomplus.hasOwnProperty('orders'))
          ) {
            resolve()
          }

          let orders = []
          // sincronizar todos?
          if (application.data.synchronize.ecomplus.orders.all && application.data.synchronize.ecomplus.orders.all === true) {
            // sincroniza todas as orders
            let ordersPath = 'orders.json?fields=_id,source_name,channel_id,number,code,status,financial_status.updated_at,financial_status.current,fulfillment_status.updated_at,fulfillment_status.current,amount,payment_method_label,shipping_method_label,buyers._id,buyers.main_email,buyers.display_name,items.product_id,items.sku,items.name,items.quantity,items.price,created_at,updated_atorders.json?fields=_id,source_name,channel_id,number,code,status,shipping_lines,transactions,financial_status.updated_at,financial_status.current,fulfillment_status.updated_at,fulfillment_status.current,amount,payment_method_label,shipping_method_label,buyers,items.product_id,items.sku,items.name,items.quantity,items.price,created_at,updated_at'
            let allOrders = await sdk.apiRequest(storeId, ordersPath, 'GET', null, null, auth).catch(e => console.log(e))
            orders = allOrders.response.data.result
          }
          // apenas ids informado?
          if (application.data.synchronize.ecomplus.orders.ids && application.data.synchronize.ecomplus.orders.ids.length > 0) {
            let orderById = application.data.synchronize.orders.ids.map(async order => {
              let result = await sdk.apiRequest(storeId, '/orders/' + order + '.json', 'GET', null, null, auth)
                .catch(e => console.log(e))
              return result.response.data
            })
            orders = await Promise.all(orderById).catch(e => console.log(e))
          }
          // token e loja id estão configurados para o aplicativo?
          if (application.hasOwnProperty('hidden_data') || application.hidden_data.bling_api_key || application.hidden_data.bling_loja_id) {
            const insertOrders = require('../methods/bling/orders/insert')({ mysql, Bling })
            const orderMap = function (order, index) {
              setTimeout(async () => {
                insertOrders(application, order, storeId).catch(e => console.log('[Bling] Erro com a order ', order._id))
              }, index * 100)
            }

            let ordersSyncronized = orders.map(orderMap)
            await Promise.all(ordersSyncronized).then(resolve).catch(e => console.log(e))
          }
          resolve()
        })
        .catch(reject)
    })
  }
}
