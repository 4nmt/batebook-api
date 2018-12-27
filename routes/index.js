var express = require('express');
var app = express(); 
var accountCtrl = require("../controllers/account")
var postCtrl = require("../controllers/post")
var interactCtrl = require("../controllers/interact")


app.get('/accounts/:publicKey', accountCtrl.findByPublicKey)
app.get('/posts/:hash', postCtrl.findByhash)
app.get('/v1/posts/:publicKey', postCtrl.findByPublicKey)

app.get('/interacts/:hash', interactCtrl.findByHash)
app.get('/v1/interacts/:publicKey', interactCtrl.findByPublicKey)




module.exports = app