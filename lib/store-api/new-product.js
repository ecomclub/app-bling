'use strict'
const { randomObjectId } = require('@ecomplus/utils')

module.exports = (produto) => {
  const schema = {}
  schema.sku = produto.codigo || ''
  schema.name = produto.descricao || ''
  schema.slug = produto.descricao ? produto.descricao.toLowerCase().replace(/[^\w ]+/g,'').replace(/ +/g,'-') : ''
  schema.available = produto.tipo === 'Ativo'
  schema.visible = produto.tipo === 'Ativo'
  schema.short_description = produto.descricao
  schema.price = Number(produto.preco)
  schema.cost_price = Number(produto.precoCusto)
  schema.body_text = produto.descricaoComplementar || ''
  schema.weight = {
    value: parseFloat(produto.pesoBruto) || 0
  }

  schema.gtin = []
  if (typeof produto.gtin === 'string' && produto.gtin !== '') {
    schema.gtin.push(produto.gtin)
  }

  if (typeof produto.gtinEmbalagem === 'string' && produto.gtinEmbalagem !== '') {
    schema.gtin.push(produto.gtinEmbalagem)
  }

  if (schema.gtin.length > 10) {
    schema.gtin = schema.gtin.slice(0,10)
  }

  const getDimensions = dimension => {
    switch (dimension) {
      case 'Centímetros':
        return 'cm'
      case 'Metros':
        return 'm'
      case 'Milímetros':
        return 'm'
      default:
        return 'cm'
    }
  }

  const unit = getDimensions(produto.unidadeMedida)

  schema.dimensions = {
    width: {
      value: parseFloat(produto.larguraProduto) || 0,
      unit,
    },
    height: {
      value: parseFloat(produto.alturaProduto) || 0,
      unit,
    },
    length: {
      value: parseFloat(produto.pesoLiq) || 0,
      unit,
    }
  }

  if (produto.descricaoCurta) {
    schema.body_html = produto.descricaoCurta
  }
  if (produto.descricaoComplementar) {
    schema.short_description = produto.descricaoComplementar.slice(0, 254)
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

  // send quantity only for common products
  if (!produto.codigoPai && !produto.variacoes) {
    schema.quantity = produto.estoqueAtual || 0
  }

  schema.condition = produto.condicao === 'Não Especificado' ? 'not_specified' : produto.condicao === 'Usado' ? 'used' : produto.condicao === 'Novo' ? 'new' : ''
  return schema
}
