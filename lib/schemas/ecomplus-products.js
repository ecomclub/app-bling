'use strict'

module.exports = (produto) => {
  let schema = {}
  schema.sku = produto.codigo || ''
  schema.name = produto.descricao || ''
  schema.available = produto.tipo === 'Ativo' ? true : false
  schema.visible = produto.tipo === 'Ativo' ? true : false
  schema.price = Number(produto.preco)
  schema.cost_price = Number(produto.precoCusto)
  schema.short_description = produto.descricaoCurta || produto.descricao
  schema.body_text = produto.descricaoComplementar
  // schema.videos = [{
  //   url: produto.urlVideo || undefined
  // }]
  // schema.brands = [{
  //   name: produto.marca || ''
  // }]
  // schema.categories = [{
  //   name: produto.categoria.descricao
  // }]
  schema.weight = {
    value: parseFloat(produto.pesoBruto) || 0
  }
  schema.gtin = [...produto.gtin, ...produto.gtinEmbalagem] || []
  schema.dimensions = {
    width: {
      value: parseFloat(produto.larguraProduto) || 0,
      unit: produto.unidadeMedida === 'Centímetros' ? 'cm' : produto.unidadeMedida === 'Metros' ? 'm' : produto.unidadeMedida === 'Milímetros' ? 'mm' : ''
    },
    height: {
      value: parseFloat(produto.alturaProduto) || 0,
      unit: produto.unidadeMedida === 'Centímetros' ? 'cm' : produto.unidadeMedida === 'Metros' ? 'm' : produto.unidadeMedida === 'Milímetros' ? 'mm' : ''
    },
    length: {
      value: parseFloat(produto.pesoLiq) || 0,
      unit: produto.unidadeMedida === 'Centímetros' ? 'cm' : produto.unidadeMedida === 'Metros' ? 'm' : produto.unidadeMedida === 'Milímetros' ? 'mm' : ''
    }
  }
  schema.condition = produto.condicao === 'Não Especificado' ? 'not_specified' : produto.condicao === 'Usado' ? 'used' : produto.condicao === 'Novo' ? 'new' : ''

  if (produto.variacoes) {
    //schema.variations = []
    produto.variacoes.forEach(variacao => {
      let variacaoTipo = variacao.variacao.nome.split(':')[0]
      let variacaoNome = variacao.variacao.nome.split(':')[1]
      let body = {
        name: produto.descricao + ' / ' + variacaoNome,
        sku: variacao.variacao.codigo,
        quantity: variacao.variacao.estoqueAtual
      }
      body.specifications = {}
      body.specifications[variacaoTipo] = [
        {
          text: variacaoNome
        }
      ]
      //schema.variations.push(body)
    })
  }
  //console.log(schema)
  return schema
}
