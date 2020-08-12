'use strict'
const newProduct = require('../../../lib/store-api/new-product')

module.exports = ({ appSdk, logger, blingClient }) => {
  return (req, res) => {
    // parsed by middlewate in (./web.js)
    const { body, storeId, appConfig } = req
    const apiKey = appConfig.bling_api_key

    const sync = (current = 0) => {
      const nextProduct = () => {
        current++
        return sync(current)
      }

      if (!body[current]) {
        return false
      }

      const options = {
        url: 'produto/' + body[current],
        method: 'get',
        apiKey
      }

      blingClient(options).then(({ data }) => {
        const { produtos } = data.retorno
        if (produtos &&
          Array.isArray(produtos) &&
          produtos[0] &&
          produtos[0].produto) {
          return produtos[0].produto
        }

        const err = new Error('Produto não encontrado na plataforma Bling; sku: ' + body[current])
        err.code = 'productNotFound'
        throw err
      }).then(produto => {
        return appSdk.apiRequest(storeId, '/products.json', 'POST', newProduct(produto))
          .then(resp => ({ resp, produto }))
      }).then(({ resp, produto }) => {
        const { data } = resp.response
        // variations?
        if (!produto.codigoPai && produto.variacoes && produto.variacoes.length) {
          const promises = []
          const resource = '/products/' + data._id + '/variations.json'
          const { variacoes } = produto
          variacoes.forEach(variacao => {
            const pVariacao = variacao.variacao
            const variations = pVariacao.nome.split(';')
            const specifications = {}

            // specifications
            for (let i = 0; i < variations.length; i++) {
              if (variations[i] !== '') {
                const variation = variations[i].split(':')
                const type = variation[0].trim()
                  .toLowerCase()
                  .replace(/[áâãà]/g, 'a')
                  .replace(/[éê]/g, 'e')
                  .replace(/[íî]/g, 'i')
                  .replace(/[óôõ]/g, 'o')
                  .replace(/[ú]/g, 'u')
                  .replace(/[ç]/g, 'c')
                  .replace(/-/g, '')
                  .replace(/\s/g, '-')
                  .replace(/[^0-9a-z-]/g, '')

                const text = variation[1].trim()
                let value
                if (type === 'colors') {
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
                  value = text.toLowerCase()
                }
                specifications[type] = [{ text, value }]
              }
            }

            const trimName = pVariacao.nome.replace(/;/g, ' / ')
            const newVariation = {
              name: `${produto.descricao} / ${trimName}`,
              sku: pVariacao.codigo,
              quantity: pVariacao.estoqueAtual,
              specifications
            }

            const promise = appSdk.apiRequest(storeId, resource, 'POST', newVariation).catch(e => logger.error('Criação da variação falhou;', e))
            promises.push(promise)
          })

          return Promise.all(promises).then(r => {
            console.log('Variações sincronizadas,', r)
            return
          })
        }
        logger.log('Produto salvo!')
        // call next product
        return nextProduct()
      }).catch(e => {
        console.log(e)
        const err = new Error('Envio manual falhou')
        err.error = e.message
        err.storeId = storeId
        if (e.response && e.response.data) {
          err.data = JSON.stringify(e.response.data)
        }
        err.product_sku = body[current]
        logger.error(JSON.stringify(err, undefined, 4))
        nextProduct()
      })
    }

    sync()
    return res.end()
  }
}
