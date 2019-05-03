'use strict'
module.exports = ({ sdk }) => {
  return (trigger, order, storeId) => {
    return new Promise(async (resolve, reject) => {
      // nota fiscal
      if (trigger.retorno.pedidos[0].pedido.hasOwnProperty('nota')) {
        if (order.hasOwnProperty('shipping_lines')) {
          let invoices = order.shipping_lines.find(shippingLine => shippingLine.hasOwnProperty('invoices'))
          // tem nota na order?
          if (invoices) {
            // alguma chave bate com a do trigger?
            let invoiceMatch = invoices.invoices.find(invoice => invoice.number === trigger.retorno.pedidos[0].pedido.nota.chaveAcesso)
            //
            if (invoiceMatch) {
              resolve({ trigger, order, storeId })
            }
          }
          let update = {
            'invoices': [
              {
                'number': trigger.retorno.pedidos[0].pedido.nota.chaveAcesso,
                'serial_number': trigger.retorno.pedidos[0].pedido.nota.numero,
                'access_key': trigger.retorno.pedidos[0].pedido.nota.chaveAcesso
              }
            ]
          }
          let resource = '/orders/' + order._id + '/shipping_lines/' + order.shipping_lines[0]._id + '.json'
          await sdk.apiRequest(storeId, resource, 'PATCH', update)
            .then(() => {
              resolve({ trigger, order, storeId })
            })
            .catch(e => reject(e.res.data))
        }
      }
      // ok next
      resolve({ trigger, order, storeId })
    })
  }
}
