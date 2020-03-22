'use strict'

module.exports = data => {
  const produto = {
    codigo: data.sku,
    descricao: data.body_text || data.name,
    descricaoCurta: data.short_description || data.name,
    un: 'un',
    vlr_unit: data.price,
    preco_custo: data.cost_price || undefined,
    estoque: data.quantity
  }

  // peso
  const { weight } = data
  if (weight && weight.value) {
    let weightValue
    switch (weight.unit) {
      case 'kg':
        weightValue = weight.value
        break
      case 'g':
        weightValue = weight.value / 1000
        break
      case 'mg':
        weightValue = weight.value / 1000000
    }
    produto.peso_bruto = weightValue
  }

  // marca
  if (data.brand) {
    const brand = data.brands.find(brand => brand.name)
    produto.marca = brand.name
  }

  // condição
  if (data.condition) {
    const { condition } = data
    let productCondition
    switch (condition) {
      case 'new':
        productCondition = 'Novo'
        break
      case 'used':
        productCondition = 'Usado'
        break
      case 'not_specified':
        productCondition = 'Não especificado'
        break
      default:
        productCondition = 'Não especificado'
        break
    }

    produto.codicao = productCondition
  }

  // gtin
  if (data.gtin && data.gtin.length) {
    produto.gint = data.gtin[0]
  }

  const { dimensions } = data

  const convertUnit = dimension => {
    switch (dimension.unit) {
      case 'cm':
        return dimension.value
        break
      case 'm':
        return dimension.value * 100
        break
      case 'mm':
        return dimension.value / 10
    }
  }

  // largura
  if (dimensions && dimensions.width) {
    produto.largura = convertUnit(dimensions.width)
  }

  // altura
  if (dimensions && dimensions.height) {
    produto.altura = convertUnit(dimensions.height)
  }

  // profundidade
  if (dimensions && dimensions.length) {
    produto.profundidade = convertUnit(dimensions.length)
  }

  // variações
  if (data.variations) {
    const { variations } = data
    const variacoes = []
    variations.forEach(variation => {
      const { specifications } = variation
      let name = ''
      for (const k in specifications) {
        name += k
        if (specifications[k]) {
          for (const j in specifications[k]) {
            name += ':' + specifications[k][j].text
          }
        }
        name += ';'
      }

      variacoes.push({
        variacao: {
          nome: name.substring(0, name.length, -1), // remove last ;
          codigo: variation.sku,
          vlr_unit: variation.price || undefined,
          estoque: variation.quantity || 0
        }
      })
    })

    produto.variacoes = variacoes
  }

  // pictures
  if (data.pictures && data.pictures.length) {
    const picture = data.pictures.find(picture => picture.normal)
    if (picture.normal) {
      produto.imagens = {
        url: picture.normal.url || ''
      }
    }
  }

  const schema = {
    produto
  }

  return schema
}
