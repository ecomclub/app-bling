'use strict'
const { randomObjectId } = require('@ecomplus/utils')

module.exports = (produto) => {
  const schema = {}
  schema.sku = produto.codigo || ''
  schema.name = produto.descricao || ''
  schema.available = produto.tipo === 'Ativo'
  schema.visible = produto.tipo === 'Ativo'
  schema.short_description = produto.descricao
  schema.price = Number(produto.preco)
  schema.cost_price = Number(produto.precoCusto)
  schema.body_text = produto.descricaoComplementar || ''
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

  if (produto.descricaoCurta) {
    schema.short_description = produto.descricaoCurta.slice(0, 254)
  }

  if (produto.imagem && produto.imagem.length) {
    schema.pictures = []
    produto.imagem.forEach(img => {
      schema.pictures.push({
        _id: randomObjectId(),
        normal: {
          url: img.link
        }
      })
    })
  }
  schema.condition = produto.condicao === 'Não Especificado' ? 'not_specified' : produto.condicao === 'Usado' ? 'used' : produto.condicao === 'Novo' ? 'new' : ''
  return schema
}
