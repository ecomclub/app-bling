'use strict'
const registerProcedures = async (ecomAuth, storeId, lojaId, authenticationId) => {
  console.log('Procedure registrado para', lojaId)
  const promise = new Promise((resolve, reject) => {
    ecomAuth.then(async sdk => {
      sdk.getAuth(storeId, authenticationId)
        .then(async auth => {
          let params = {
            title: 'Bling Application Hooks',
            triggers: [
              {
                resource: 'products'
              },
              {
                resource: 'orders'
              }
            ],
            webhooks: [
              {
                api: {
                  external_api: { // debug
                    uri: 'https://bling.ecomplus.biz/triggers/ecomplus?lojaId=' + lojaId
                  }
                },
                method: 'POST',
                send_body: true
              }
            ]
          }
          sdk.apiRequest(storeId, '/procedures.json', 'POST', params, auth).then(resolve).catch(e => { console.log(e) })
        })
        .catch(e => console.log(e))
    })
  })
  return promise
}

module.exports = registerProcedures
