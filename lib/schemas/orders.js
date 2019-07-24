'use strict'

const blingOrderSchema = order => {
  try {
    let items = items => {
      if (items) {
        let itemsArray = items.map(item => {
          return {
            'item': {
              'codigo': item.sku,
              'descricao': item.name,
              'qtde': item.quantity,
              'vlr_unit': item.price
            }
          }
        })
        return itemsArray || []
      }
      return []
    }
    let schema = {
      'pedido': {
        'numero': order.number,
        'cliente': {
          'nome': order.buyers ? order.buyers[0].display_name : '',
          'tipoPessoa': order.buyers ? order.buyers[0].registry_type : '',
          'endereco': order.hasOwnProperty('shipping_lines') ? order.shipping_lines[0].to.street : '',
          'cpf_cnpj': order.hasOwnProperty('buyers') ? order.buyers[0].doc_number : '',
          // 'ie_rg': '3067663000',
          'numero': order.hasOwnProperty('shipping_lines') ? order.shipping_lines[0].to.number : '',
          'complemento': order.hasOwnProperty('shipping_lines') ? order.shipping_lines[0].to.complement : '',
          'bairro': order.hasOwnProperty('shipping_lines') ? order.shipping_lines[0].to.borough : '',
          'cep': order.hasOwnProperty('shipping_lines') ? order.shipping_lines[0].to.zip : '',
          'cidade': order.hasOwnProperty('shipping_lines') ? order.shipping_lines[0].to.city : '',
          'uf': order.hasOwnProperty('shipping_lines') ? order.shipping_lines[0].to.province_code : '',
          // 'fone': order.buyers[0].phones[0].number || '',
          'email': order.hasOwnProperty('buyers') ? order.buyers[0].main_email : ''
        },
        'transporte': {
          'transportadora': order.hasOwnProperty('shipping_lines') ? order.shipping_lines[0].app.service_name : '',
          'tipo_frete': 'D',
          'servico_correios': order.hasOwnProperty('shipping_lines') ? order.shipping_lines[0].app.carrier : '',
          'dados_etiqueta': {
            'nome': order.hasOwnProperty('buyers') ? order.buyers[0].display_name : '',
            'endereco': (order.hasOwnProperty('shipping_lines') && order.shipping_lines.hasOwnProperty('to')) ? order.shipping_lines[0].to.street : '',
            'numero': (order.hasOwnProperty('shipping_lines') && order.shipping_lines.hasOwnProperty('to')) ? order.shipping_lines[0].to.number : '',
            'complemento': (order.hasOwnProperty('shipping_lines') && order.shipping_lines.hasOwnProperty('to')) ? order.shipping_lines[0].to.complement : '',
            'municipio': (order.hasOwnProperty('shipping_lines') && order.shipping_lines.hasOwnProperty('to')) ? order.shipping_lines[0].to.province : '',
            'uf': (order.hasOwnProperty('shipping_lines') && order.shipping_lines.hasOwnProperty('to')) ? order.shipping_lines[0].to.province_code : '',
            'cep': (order.hasOwnProperty('shipping_lines') && order.shipping_lines.hasOwnProperty('to')) ? order.shipping_lines[0].to.zip : '',
            'bairro': (order.hasOwnProperty('shipping_lines') && order.shipping_lines.hasOwnProperty('to')) ? order.shipping_lines[0].to.borough : ''
          }
        },
        'itens': items(order.items),
        // 'parcelas': [
        //   {
        //     'data': '01/09/2009',
        //     'vlr': '100',
        //     'obs': 'Teste obs 1'
        //   }
        // ],
        'vlr_frete': order.amount ? order.amount.freight : '',
        'vlr_desconto': order.amount ? order.amount.discount : ''
      }
    }
    return schema
  } catch (error) {
    throw error
  }
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
