module.exports = ({ sdk }) => {
  return (trigger, order, storeId) => {
    return new Promise(async (resolve, reject) => {
      // verifica se a ordem possui o código de rastreio existente no pedido
      if (trigger.retorno.pedidos[0].pedido.transporte.hasOwnProperty('volumes')) {
        if (order.hasOwnProperty('shipping_lines')) {
          let trackingServices = order.shipping_lines.find(line => line.hasOwnProperty('tracking_codes'))
          let trackingCodes = trigger.retorno.pedidos[0].pedido.transporte.volumes.map(volume => {
            if (volume.volume.codigoRastreamento) {
              return {
                'codigo': volume.volume.codigoRastreamento,
                'tag': volume.volume.servico
              }
            }
          })
          // se a order ja tiver o código de restreio next
          if (trackingServices) {
            let trackingCodesOrder = trackingServices.find(tracking => trackingCodes.includes(tracking.code))
            if (trackingCodesOrder) {
              resolve({ trigger, order, storeId })
            }
          }

          // não tem insere o código no ratreio no shipping_lines

          let update = {
            'tracking_codes': trackingCodes.map(tracking => {
              return {
                'code': tracking.codigo,
                'tag': tracking.tag.replace(' ', '').toLowerCase()
              }
            })
          }
          let resource = '/orders/' + order._id + '/shipping_lines/' + order.shipping_lines[0]._id + '.json'
          await sdk.apiRequest(storeId, resource, 'PATCH', update)
            .then(() => {
              resolve({ trigger, order, storeId })
            })
            .catch(e => reject(e.res.data))
        }
      }
    })
  }
}