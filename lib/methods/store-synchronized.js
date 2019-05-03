'use strict'
const logger = require('console-files')

module.exports = ({ ecomAuth, db }) => {
  return (storeId, authenticationId, applicationId) => {
    return new Promise(async (resolve, reject) => {
      console.log('Finalizando Sincronização de orders e produtos.')
      const sdk = await ecomAuth.then()
      const auth = await sdk.getAuth(storeId, authenticationId)
      let findApp = await sdk.apiApp(storeId, null, 'GET', null, auth).catch(e => console.log(e))
      const application = findApp.response.data

      let sql = 'UPDATE bling_app_settings SET store_synchronized = ?, store_synchronized_at = CURRENT_TIMESTAMP ' +
        'WHERE store_id = ? AND authentication_id = ? AND application_id = ?'
      let values = [
        1,
        storeId,
        authenticationId,
        applicationId
      ]
      db.run(sql, values, err => {
        if (!err) {
          // registra procedure
          require('./../services/procedures')(ecomAuth, storeId, application.hidden_data.bling_loja_id, authenticationId)
        } else {
          logger.error('Erro storeSynchronized', err)
        }
      })
    })
  }
}