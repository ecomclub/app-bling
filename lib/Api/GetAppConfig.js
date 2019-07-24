'use strict'
module.exports = (db) => {
  return (storeId, applicationId, authenticationId) => {
    return new Promise((resolve, reject) => {
      let query = `SELECT application_id, store_id, authentication_id 
          FROM bling_app_settings 
          WHERE application_id = ?
          AND store_id = ?
          AND authentication_id = ?`
      db.get(query, [applicationId, storeId, authenticationId], (erros, rows) => {
        if (erros) {
          reject(erros)
        }
        resolve(rows)
      })
    })
  }
}
