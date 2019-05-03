'use strict'

const bodyParser = require('body-parser')
const express = require('express')
const sqlite = require('sqlite3').verbose()
const app = express()
const port = process.env.PORT || 4200

//
const { ecomAuth } = require('ecomplus-app-sdk')
const Bling = require('bling-erp-sdk')
const mysql = require('./lib/database')
const db = new sqlite.Database(process.env.ECOM_AUTH_DB)
//
require('./bin/uncaughtException')
require('./lib/services/setup-stores')({ db, ecomAuth })
require('./lib/services/synchronizations')({ db, ecomAuth, mysql, Bling })

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(require('./lib/routes')({ ecomAuth, mysql, Bling, db }))
app.listen(port)
