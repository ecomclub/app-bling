'use strict'

module.exports = ({ ecomAuth, db }) => {
  return trigger => {
    return new Promise((resolve, reject) => {
      const triggerAction = trigger.action
      const storeId = trigger.store_id
      const authenticationId = trigger.authentication_id
      const applicationId = trigger.resource_id || trigger.inserted_id

      const getAppSettings = () => {
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

      const setAppSettings = () => {
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

      if (triggerAction === 'change') {
        if (trigger.fields.includes('data')) {
          // busca no banco de dados se esse applicativo
          // ja foi setado/ou teve sua sincronização realizada
          getAppSettings()
            .then(result => {
              // se não hover configuração,
              // configura como um novo
              if (!result) {
                setAppSettings()
                  .then(resolve)
                  .catch(reject)
              }
            })
            .catch(reject)
        }
      }
      // next
      resolve()
    })
  }
}
