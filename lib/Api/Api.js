const logger = require('console-files')
const sqlite = require('sqlite3').verbose()
// create necessary tables
const dbFilename = process.env.DB_PATH || process.env.ECOM_AUTH_DB || './db.sqlite'
const db = new sqlite.Database(dbFilename, err => {
  const error = err => {
    // debug and destroy Node process
    logger.error(err)
    process.exit(1)
  }

  if (err) {
    error(err)
  } else {
    // try to run first query creating table
    db.run(
      `CREATE TABLE IF NOT EXISTS bling_app_settings
      (
          id                    INTEGER
              primary key autoincrement,
          created_at            DATETIME default CURRENT_TIMESTAMP not null,
          store_id              INTEGER not null,
          authentication_id     STRING
              unique,
          application_id        INTEGER not null,
          setted_up             INTEGER  default 0,
          setted_at             DATETIME,
          store_synchronized    INT      default 0 not null,
          store_synchronized_at DATETIME
      );      
    `, err => {
        if (err) {
          error(err)
        }
      })
  }
})

const promise = new Promise(resolve => {
  return resolve({
    getAppConfig: require('./GetAppConfig')(db),
    addAppConfig: require('./AddAppConfig')(db)
  })
})

module.exports = {
  internalApi: promise
}
