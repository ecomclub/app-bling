'use strict'
module.exports = (db) => {
  return (storeId, applicationId, authenticationId) => {
    return new Promise((resolve, reject) => {
      let query = `INSERT INTO bling_app_settings 
          (store_id, authentication_id, application_id, setted_up) 
          VALUES (?,?,?,?)`
      let values = [
        storeId,
        authenticationId,
        applicationId,
        1
      ]
      db.run(query, values, function (erro) {
        if (erro) {
          reject(erro)
        }
        resolve(this.changes)
      })
    })
  }
}
