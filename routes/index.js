var express = require('express');
var app = express(); 
var accountCtrl = require("../controllers/account")

app.get('/accounts/:publicKey', accountCtrl.findByPublicKey)

module.exports = app