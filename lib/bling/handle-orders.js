'use strict'

module.exports = (configObj, appSdk, storeId) => {
  return async (trigger) => {
    let data = trigger.retorno.pedidos[0].pedido

    let resource = `/orders.json?number=${data.numero}&fields=_id,number,status,financial_status,fulfillment_status,shipping_lines,buyers,items`
    let method = 'GET'

    try {
      let result = await appSdk.apiRequest(storeId, resource, method)
      let order = result.response.data.result

      if (order) {
        let promises = []

        // update orders.invoice
        let invoices = new Promise((resolve, reject) => {
          if (data.hasOwnProperty('nota')) {
            // look for invoices at order
            let orderInvoices = order.shipping_lines.find(shipping => shipping.hasOwnProperty('invoices'))
            // checks if invoice number exist
            if (orderInvoices) {
              let match = orderInvoices.invoices.find(invoice => invoice.number === data.nota.chaveAcesso)
              // if invoice number not match with chaveAcesso
              // insert chaveAcesso at order
              if (!match) {
                let update = [
                  {
                    number: data.nota.chaveAcesso,
                    serial_number: data.nota.numero,
                    access_key: data.nota.chaveAcesso
                  }
                ]
                // patch order
                let resource = `/orders/${order._id}/shipping_lines/${order.shipping_lines[0]._id}.json`
                return appSdk.apiRequest(storeId, resource, 'PATCH', update)
              }
            }
          }
          resolve()
        })

        // update orders.financial_status
        let financialStatus = new Promise((resolve, reject) => {
          if (!order.hasOwnProperty('financial_status') ||
            order.financial_status.current !== parseStatus(data.situacao)) {
            let update = {
              financial_status: {
                current: parseStatus(data.situacao)
              }
            }
            let resource = `/orders/${order._id}.json`
            return appSdk.apiRequest(storeId, resource, 'PATCH', update)
          }
          resolve()
        })

        // update orders.shipping_lines
        let shippingLines = new Promise((resolve, reject) => {
          if (data.transporte.hasOwnProperty('volumes')) {
            if (order.hasOwnProperty('shipping_lines')) {
              // find for tracking codes at bling pedido
              let trackingCodes = data.transporte.volumes.map(volume => {
                if (volume.volume.codigoRastreamento) {
                  return {
                    codigo: volume.volume.codigoRastreamento,
                    tag: volume.volume.servico
                  }
                }
              })

              if (trackingCodes) {
                let update = {
                  tracking_codes: trackingCodes.map(code => {
                    return {
                      code: code.codigo,
                      tag: code.tag.replace(' ', '').toLowerCase()
                    }
                  })
                }

                let resource = `/orders/${order._id}/shipping_lines/${order.shipping_lines[0]._id}.json`
                return appSdk.apiRequest(storeId, resource, 'PATCH', update)
              }
            }
          }
          resolve()
        })

        // check if app is able to
        // make all of changes
        if (configObj.hasOwnProperty('synchronize') &&
          configObj.synchronize.hasOwnProperty('bling')) {
          if (configObj.synchronize.bling.invoice) {
            promises.push(invoices)
          }
          if (configObj.synchronize.bling.financial_status) {
            promises.push(financialStatus)
          }
          if (configObj.synchronize.bling.shipping_lines) {
            promises.push(shippingLines)
          }
        }

        return Promise.all(promises)
      }
    } catch (error) {
      console.log(error)
    }
  }
}

const parseStatus = (status) => {
  switch (status) {
    case 'Em Aberto':
      return 'pending' // financial_status.current
    case 'Em Andamento':
    case 'Em digitação':
      break
    case 'Venda agenciada':
    case 'Atendido': // financial_status.current
      return 'paid'
    case 'Cancelado': // financial_status.current
      return 'voided'
  }
}