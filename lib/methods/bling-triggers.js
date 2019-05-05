'use strict'

module.exports = ({ mysql, ecomAuth }) => {
  return async (req, res) => {
    // lojaId, storeId enviados via url, configurado no webhook no bling
    const {
      storeId,
      lojaId
    } = req.query

    let requestBody = req.body
    let { data } = requestBody

    if (data == null) {
      return res.status(400).send({ error: 'no body in the request' })
    }

    if (!storeId || !lojaId) {
      return res.status(400).send({ error: 'storeId or lojaId not sent in the request' })
    }

    const success = () => res.status(200).end()
    const fail = () => res.status(400).end()

    try {
      let trigger = JSON.parse(data)
      const sdk = await ecomAuth.then()

      // atualiza produto
      if (trigger.retorno.hasOwnProperty('estoques')) {
        let updateProduct = require('./ecomplus/products/update')({ mysql, ecomAuth })
        updateProduct(trigger, storeId, lojaId)
          .then(success())
          .catch(fail())
      }

      // atualiza pedido
      if (trigger.retorno.hasOwnProperty('pedidos')) {
        let resource = '/orders.json?number=' + trigger.retorno.pedidos[0].pedido.numero + '&fields=_id,number,status,financial_status,fulfillment_status,shipping_lines,buyers,items'
        const order = await sdk.apiRequest(storeId, resource, 'GET').catch(e => console.log(e))

        // se houver order pra busca atualiza
        if (order.res.data.result) {
          let invoices = require('./ecomplus/orders/invoice')({ sdk })
          let financialStatus = require('./ecomplus/orders/financial-status')({ sdk })
          let shippingLines = require('./ecomplus/orders/shipping-lines')({ sdk })

          invoices(trigger, order, storeId)
            .then(financialStatus)
            .then(shippingLines)
            .then(success())
            .catch(fail())
        } else {
          // insere na api a order
        }
      }
    } catch (error) {
      console.log('' + error)
      fail()
    }
  }
}
