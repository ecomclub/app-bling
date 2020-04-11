const getConfig = require('./store-api/get-config')
/**
 * @class MapStores
 * @classdesc Applies a function on each element of a store list
 * @property {Object} appSdk - E-Com Plus appSdk instance
 */
class MapStores {
  constructor (appSdk) {
    this.current = 0
    this.storeId = 0
    this.retry = 0
    this.appSdk = appSdk
  }

  next (stores, callback) {
    this.current++
    this.tasks(stores, callback)
  }

  /**
   * @name tasks
   * @param {Array} stores | array of storeIds
   * @param {Function} {callback} function to apply on every storeId
   * @return {(Function | Promise)}
   */
  tasks (stores, callback) {
    if (stores && stores[this.current]) {
      this.storeId = stores[this.current]
      const { storeId, appSdk } = this
      // call next task
      const next = fn => {
        if (typeof fn === 'function') {
          fn().then(() => console.log('Promise finish')).catch(() => console.error('next function error'))
        }
        return this.next(stores, callback)
      }
      // call current task
      const task = () => this.tasks(stores, callback)

      getConfig({ appSdk, storeId }, true)
        .then(configObj => {
          callback(configObj, storeId, next, task, null)
        })
        .catch(e => {
          if (e.response && e.response.status >= 500) {
            if (this.retry <= 5) {
              setTimeout(() => {
                task()
              }, 4000)
              this.retry++
            } else {
              next()
            }
          } else {
            let error
            if (e.response && e.response.data) {
              error = e.response.data
            } else {
              error = e.message
            }
            callback(null, storeId, next, task, error)
          }
        })
    } else {
      callback(null, null, null, null, null)
    }
  }
}

module.exports = MapStores
