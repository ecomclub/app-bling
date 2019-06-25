'use strict'
const logger = require('console-files')

module.exports = ({ ecomAuth, db }) => {
  return (storeId) => {
    return new Promise(async (resolve, reject) => {
      console.log('Finalizando Sincronização de orders e produtos.')
      const sdk = await ecomAuth.then()
      const auth = await sdk.getAuth(storeId)
      let findApp = await sdk.apiApp(storeId, null, 'GET', null, auth).catch(e => console.log(e))
      const application = findApp.response.data

      let sql = `UPDATE bling_app_settings 
      SET store_synchronized = ?, store_synchronized_at = CURRENT_TIMESTAMP 
      WHERE store_id = ? 
      AND authentication_id = ? 
      AND application_id = ?`
      let values = [
        1,
        storeId,
        auth.row.authentication_id,
        auth.row.application_id
      ]
      console.log(values)
      db.run(sql, values, err => {
        if (!err) {
          // registra procedure
          // require('./../services/procedures')(ecomAuth, storeId, application.hidden_data.bling_loja_id, authenticationId)
          let proceduresBody = {
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
                    uri: 'https://bling.ecomplus.biz/triggers/ecomplus?lojaId=' + application.hidden_data.bling_loja_id
                  }
                },
                method: 'POST',
                send_body: true
              }
            ]
          }
          const procedures = require('./../services/_procedures')({ ecomAuth })
          procedures(proceduresBody, storeId)
            .then(resolve)
            .catch(reject)
        } else {
          reject(new Error('Erro storeSynchronized'))
          logger.error('Erro storeSynchronized', err)
        }
      })
    })
  }
}
