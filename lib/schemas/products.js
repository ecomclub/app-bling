'use strict'

const blingProductSchema = product => {
  const variacoes = product => {
    let variations = []
    if (product.hasOwnProperty('variations')) {
      variations = product.variations.map(variation => {
        let variationName = ''
        for (const key in variation.specifications) {
          variationName += key
          for (const chave in variation.specifications[key]) {
            variationName += ':' + variation.specifications[key][chave]['text'] + ';'
          }
        }

        return {
          'variacao': {
            'nome': variationName.substring(0, variationName.length - 1),
            'codigo': variation.sku
            // 'vlr_unit': '1.55',
            // 'deposito': {
            //   'id': '123456',
            //   'estoque': '200'
          }
        }
      })
    }
    return variations
  }

  let item = {
    'produto': {
      'codigo': product.sku,
      'descricao': product.hasOwnProperty('body_text') ? product.body_text : product.name,
      'descricaoCurta': product.short_description || null,
      // 'descricaoComplementar': 'Descrição complementar da caneta',
      // 'un': 'un',
      'vlr_unit': product.price,
      'preco_custo': product.cost_price || null,
      'estoque': product.quantity,
      // 'peso_bruto': '0.2',
      // 'peso_liq': '0.18',
      // 'class_fiscal': [
      //   '1000.01.01',
      //   '1111.11.11'
      // ],
      // 'marca': 'Marca da Caneta', // na ecom é array
      // 'origem': '0',
      // 'gtin': '223435780', // na ecom é array
      // 'gtinEmbalagem': '54546',
      'largura': product.dimensions ? product.dimensions.width.value : null,
      'altura': product.dimensions ? product.dimensions.height.value : null,
      // 'profundidade': '31',
      // 'estoqueMinimo': '1.00',
      // 'estoqueMaximo': '100.00',
      // 'cest': '28.040.00', // ?
      // 'idGrupoProduto': '12345', // e quando for array?
      // 'condicao': 'Usado',
      // 'freteGratis': 'S',
      'linkExterno': product.slug || null,
      // 'observacoes': 'Observações do meu produto',
      // 'producao': 'P',
      // 'unidadeMedida': 'Centímetros',
      // 'crossdocking': '2',
      // 'garantia': '4',
      // 'itensPorCaixa': '2',
      // 'volumes': '2',
      // 'urlVideo': 'https://www.youtube.com/watch?v=zKKL-SgC5lY',
      'variacoes': variacoes(product),
      'imagens': {
        'url': product.hasOwnProperty('pictures') ? product.pictures[0].normal.url : ''
      }
    }
  }
  //
  return item
}

module.exports = {
  blingProductSchema
}
