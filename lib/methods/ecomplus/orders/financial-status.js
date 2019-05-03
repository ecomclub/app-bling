module.exports = ({ sdk }) => {
  return (trigger, order, storeId) => {
    return new Promise(async (resolve, reject) => {
      if (!order.hasOwnProperty('financial_status') || order.financial_status.current !== parseStatus(trigger.retorno.pedidos[0].pedido.situacao)) {
        let update = {
          'financial_status': {
            'current': parseStatus(trigger.retorno.pedidos[0].pedido.situacao)
          }
        }
        let resource = '/orders/' + order._id + '.json'
        await sdk.apiRequest(storeId, resource, 'PATCH', update)
          .then(() => {
            resolve({ trigger, order, storeId })
          })
          .catch(e => reject(e.response))
      }
      resolve({ trigger, order })
    })
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
