'use strict'
const { randomObjectId } = require('@ecomplus/utils')

const axios = require('axios')
const FormData = require('form-data')
const logger = require('console-files')

const removeAccents = str => str.replace(/áàãâÁÀÃÂ/g, 'a')
  .replace(/éêÉÊ/g, 'e')
  .replace(/óõôÓÕÔ/g, 'o')
  .replace(/íÍ/g, 'e')
  .replace(/úÚ/g, 'u')
  .replace(/çÇ/g, 'c')

const tryImageUpload = (storeId, auth, originImgUrl, product) => new Promise(resolve => {
  axios.get(originImgUrl, {
    responseType: 'arraybuffer'
  })
    .then((response) => {
      const { data, headers } = response
      const form = new FormData()
      let fileName = originImgUrl.replace(/.*\/([^/]+)$/, '$1')
 
      if (headers && headers['content-type']) {
        const contentType = headers['content-type'].split('/')
        fileName = product.slug.substring(0, 50) + '.' + contentType[1]
      }

      form.append('file', Buffer.from(data), fileName)

      return axios.post(`https://apx-storage.e-com.plus/${storeId}/api/v1/upload.json`, form, {
        headers: {
          ...form.getHeaders(),
          'X-Store-ID': storeId,
          'X-My-ID': auth.myId,
          'X-Access-Token': auth.accessToken
        }
      })

        .then(({ data, status }) => {
          if (data.picture) {
            for (const imgSize in data.picture) {
              if (data.picture[imgSize] && data.picture[imgSize].size !== undefined) {
                delete data.picture[imgSize].size
              }
              data.picture[imgSize].alt = `${product.name} (${imgSize})`
            }
            return resolve({
              _id: randomObjectId(),
              ...data.picture
            })
          }
          const err = new Error('Unexpected Storage API response')
          err.response = { data, status }
          throw err
        })
        .catch(err => {
          if (err.response && err.response.status >= 500) {
            logger.error('UploadErr', err.message)
            resolve({
              _id: randomObjectId(),
              normal: {
                url: originImgUrl,
                alt: product.name
              }
            })
          }

          return null
        })
    })

    .catch(err => {
      logger.error(err)
      resolve({
        _id: randomObjectId(),
        normal: {
          url: originImgUrl,
          alt: product.name
        }
      })
    })
}).then(picture => {
  if (product && product.pictures) {
    product.pictures.push(picture)
  }
  return picture
})

module.exports = (produto, storeId, auth) => new Promise((resolve, reject) => {
  const name = produto.descricao.trim()
  let slug = removeAccents(produto.descricao.toLowerCase())
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_./]/g, '')
  if (/[a-z0-9]/.test(slug.charAt(0))) {
    slug = `p-${slug}`
  }

  const product = {
    sku: produto.codigo,
    name,
    slug,
    price: Number(produto.preco),
    cost_price: Number(produto.precoCusto),
    quantity: produto.estoqueAtual || 0
  }

  const weight = parseFloat(produto.pesoBruto)
  if (weight > 0) {
    product.weight = {
      value: weight,
      unit: 'kg'
    }
  }

  if (produto.situacao === 'Inativo') {
    product.visible = false
  }

  if (produto.descricaoComplementar) {
    product.body_text = produto.descricaoComplementar
  }

  product.gtin = []
  if (typeof produto.gtin === 'string' && produto.gtin !== '') {
    product.gtin.push(produto.gtin)
  }

  if (typeof produto.gtinEmbalagem === 'string' && produto.gtinEmbalagem !== '') {
    product.gtin.push(produto.gtinEmbalagem)
  }

  if (product.gtin.length > 10) {
    product.gtin = product.gtin.substring(0, 10)
  }

  if (typeof produto.codigoFabricante === 'string' && produto.codigoFabricante !== '') {
    product.mpn = [produto.codigoFabricante.substring(0, 70)]
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

    ;[
      ['larguraProduto', 'width'],
      ['alturaProduto', 'height'],
      ['profundidadeProduto', 'length']
    ].forEach(([lado, side]) => {
      const value = parseFloat(produto[lado])
      if (value > 0) {
        if (!product.dimensions) {
          product.dimensions = {}
        }

        product.dimensions[side] = { unit, value }
      }
    })


  if (produto.descricaoCurta) {
    product.body_html = produto.descricaoCurta
  }

  product.condition = produto.condicao === 'Não Especificado' ? 'not_specified' : produto.condicao === 'Usado' ? 'used' : produto.condicao === 'Novo' ? 'new' : ''

  // variations
  if (!produto.codigoPai && produto.variacoes && produto.variacoes.length) {
    delete product.quantity
    product.variations = []
    produto.variacoes.forEach(({ variacao }) => {
      const { nome, codigo, estoqueAtual } = variacao
      const blingVariations = nome.split(';')
      const specifications = {}

      for (let i = 0; i < blingVariations.length; i++) {
        if (blingVariations[i] !== '') {
          const blingSpecifications = blingVariations[i].split(':')
          const type = removeAccents(blingSpecifications[0].trim()).toLowerCase()
          const text = blingSpecifications[1].trim()
          let value
          if (type === 'colors' || type === 'cor') {
            switch (text.toLowerCase()) {
              case 'preto':
                value = '#000000'
                break
              case 'vermelho':
                value = '#ff0000'
                break
              case 'azul':
                value = '#0000ff'
                break
              case 'branco':
                value = '#ffffff'
                break
              case 'roxo':
                value = '#800080'
                break
              case 'cinza':
                value = '#808080'
                break
              case 'amarelo':
                value = '#ffff00'
                break
              case 'rosa':
                value = '#ff00ff'
                break
            }
          } else {
            value = text.toLowerCase().substring(0, 100)
          }
          specifications[type] = [{ text, value }]
        }
      }

      const variation = {
        _id: randomObjectId(),
        name: `${produto.descricao} / ${nome.replace(/;/g, ' / ')}`.substring(0, 100),
        quantity: estoqueAtual,
        sku: codigo,
        specifications
      }

      product.variations.push(variation)
    })
  }

  if (produto.imagem && produto.imagem.length) {
    const promises = []
    product.pictures = []
    produto.imagem.forEach(img => {
      if (img.link) {
        promises.push(new Promise((resolve) => setTimeout(() => {
          tryImageUpload(storeId, auth, img.link, product).then(() => resolve())
        }, (promises.length + 1) * 2000)))
      }
    })

    return Promise.all(promises).then(() => resolve(product))
  }

  return resolve(product)
})