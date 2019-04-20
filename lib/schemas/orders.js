'use strict'

const blingOrderSchema = order => {
  try {
    let items = items => {
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
    let schema = {
      'pedido': {
        'cliente': {
          'nome': order.buyers ? order.buyers[0].display_name : '',
          'tipoPessoa': order.buyers ? order.buyers[0].registry_type : '',
          'endereco': order.shipping_lines[0].to.street || '',
          'cpf_cnpj': order.buyers[0].doc_number || '',
          // 'ie_rg': '3067663000',
          'numero': order.shipping_lines[0].to.number || '',
          'complemento': order.shipping_lines[0].to.complement || '',
          'bairro': order.shipping_lines[0].to.borough || '',
          'cep': order.shipping_lines[0].to.zip || '',
          'cidade': order.shipping_lines[0].to.city || '',
          'uf': order.shipping_lines[0].to.province_code || '',
          // 'fone': order.buyers[0].phones[0].number || '',
          'email': order.buyers[0].main_email || ''
        },
        'transporte': {
          'transportadora': order.shipping_lines[0].app.service_name || '',
          'tipo_frete': 'D',
          'servico_correios': order.shipping_lines[0].app.carrier || '',
          'dados_etiqueta': {
            'nome': order.buyers[0].display_name || '',
            'endereco': order.shipping_lines[0].to.street || '',
            'numero': order.shipping_lines[0].to.number || '',
            'complemento': order.shipping_lines[0].to.complement || '',
            'municipio': order.shipping_lines[0].to.province || '',
            'uf': order.shipping_lines[0].to.province_code || '',
            'cep': order.shipping_lines[0].to.zip || '',
            'bairro': order.shipping_lines[0].to.borough || ''
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
        'vlr_frete': order.amount.freight || '',
        'vlr_desconto': order.amount.discount || ''
      }
    }
    return schema
  } catch (error) {
    console.log(error)
  }
}

const ecomplusOrderSchema = pedido => {

}

module.exports = {
  blingOrderSchema,
  ecomplusOrderSchema
}
