'use strict'

module.exports = ({ ecomAuth, mysql, Bling }) => {
  return (storeId) => {
    return new Promise(async (resolve, reject) => {
      const sdk = await ecomAuth.then()
      // checa configurações do aplicativo
      // para verificar se é possível realizar a sincronização
      // dos produtos para o bling
      sdk.apiApp(storeId, null, 'GET')
        .then(async resp => {
          let application = resp.response.data
          // se os produtos não forem configurados
          // para sincronização next..
          if (!application.hasOwnProperty('data') ||
            !application.data.hasOwnProperty('synchronize') ||
            (application.data.hasOwnProperty('synchronize') &&
              !application.data.synchronize.hasOwnProperty('ecomplus')) ||
            (application.data.synchronize.hasOwnProperty('ecomplus') &&
              !application.data.synchronize.ecomplus.hasOwnProperty('products'))
          ) {
            resolve()
          }

          let products = []
          // sincronizar todos os produtos da loja
          if (application.data.synchronize.ecomplus.products.hasOwnProperty('all') && (application.data.synchronize.ecomplus.products.all && application.data.synchronize.ecomplus.products.all === true)) {
            let allproducts = await sdk.apiRequest(storeId, '/products.json', 'GET').catch(e => console.log(e))
            products = allproducts.response.data.result.map(product => product._id)
          }
          //  ou apenas os id informados?
          if (application.data.synchronize.ecomplus.hasOwnProperty('ids') && (application.data.synchronize.products.ids && application.data.synchronize.products.ids.length > 0)) {
            products = application.data.synchronize.products.ids
          }

          // token e loja id estão configurados para o aplicativo?
          if (application.hasOwnProperty('hidden_data') || application.hidden_data.bling_api_key || application.hidden_data.bling_loja_id) {
            const insertProduct = require('../methods/bling/products/insert')({ mysql, Bling })
            const productsMap = function (product, index) {
              setTimeout(() => {
                return sdk.apiRequest(storeId, '/products/' + (product._id || product) + '.json', 'GET')
                  .then((resp) => insertProduct(application, resp).catch(e => console.log('[Bling] Erro ao sincronizar o produto ', (product._id || product))))
              }, index * 1000)
            }

            let allProducts = products.map(productsMap)
            await Promise.all(allProducts).then(resolve(storeId)).catch(e => console.log(e))
          }
          resolve()
        })
        .catch(reject)
    })
  }
}
