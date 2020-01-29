'use strict'

const blingOrderSchema = order => {

  const { amount, buyers, shipping_lines, items } = order
  let erros
  if (!amount) {
    erros = new Error('Order sem campo amount (totais)')
    erros.type = 'OrderAmountErr'
  } else if (!buyers || !Array.isArray(buyers)) {
    erros = new Error('Order sem informações do buyers (comprador)')
    erros.type = 'OrderBuyersErr'
  } else if (!shipping_lines || !Array.isArray(shipping_lines)) {
    erros = new Error('Order sem informações de shipping_lines (envio)')
    erros.type = 'OrderShippingLinesErr'
  } else if (!items || !Array.isArray(items)) {
    erros = new Error('Order sem informações de items')
    erros.type = 'OrderItemsLinesErr'
  }

  if (erros) {
    throw erros
  }

  const shippingLines = order.shipping_lines[0]

  const cliente = {
    nome: buyers[0].display_name,
    tipoPessoa: buyers[0].registry_type,
    endereco: shippingLines.to.street,
    cpf_cnpj: buyers[0].doc_number,
    numero: shippingLines.to.number,
    complemento: shippingLines.to && shippingLines.to.complement ? shippingLines.to.complement : '',
    bairro: shippingLines.to.borough,
    cep: shippingLines.to.zip,
    cidade: shippingLines.to.city,
    uf: shippingLines.to.province_code,
    fone: buyers[0].phones && buyers[0].phones ? buyers[0].phones[0].number : '',
    email: buyers[0].main_email
  }

  const transporte = {
    transportadora: shippingLines && shippingLines.app ? shippingLines.app.service_name : '',
    tipo_frete: 'D',
    servico_correios: shippingLines && shippingLines.app ? shippingLines.app.carrier : '',
    dados_etiqueta: {
      nome: buyers[0].display_name,
      endereco: shippingLines.to.street,
      numero: shippingLines.to.number,
      complemento: shippingLines.to && shippingLines.to.complement ? shippingLines.to.complement : '',
      municipio: shippingLines.to.city,
      uf: shippingLines.to.province_code,
      cep: shippingLines.to.zip,
      bairro: shippingLines.to.borough
    }
  }

  const itens = []

  items.map(item => {
    itens.push({
      item: {
        codigo: item.sku,
        descricao: item.name,
        qtde: item.quantity,
        vlr_unit: item.price,
        un: 'un'
      }
    })
  })

  const pedido = {
    pedido: {
      numero: order.number,
      vlr_frete: amount.freight || 0,
      vlr_desconto: amount.discount || 0,
      cliente,
      transporte,
      itens
    }
  }

  return pedido
}

const ecomplusOrderSchema = pedido => {
  try {
    let shipping_lines = pedido => {
      return {
        'financial_status': {
          'current': parseStatus(pedido.retorno.pedidos[0].pedido.situacao)
        }
      }
    }
    let transactions = pedido => {
    }
    let items = pedido => {
    }
    let amount = pedido => {
    }
    let buyers = pedidos => {
    }
  } catch (error) {

  }
}

module.exports = {
  blingOrderSchema,
  ecomplusOrderSchema
}
