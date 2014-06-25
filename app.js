#!/usr/bin/env node --harmony

/***
 firstServer.js
 This is a simple server illustrating middleware and basic REST functionality
 This demo also adds the mongo database connection, but everything is in one file
 on the server side. We will break this out so that it has model/view/controller on
 the server and client in the next demo...
 ***/

'use strict';
var express = require('express');
var bodyParser = require('body-parser'); // this allows us to pass JSON values to the server (see app.put below)
var app = express();

var monk = require('monk');
var db = monk('localhost:27017/shopping');


// serve static content from the public folder 
app.use("/", express.static(__dirname + '/public'));


// parse the bodies of all other queries as json
app.use(bodyParser.json());


// log the requests
app.use(function(req, res, next) {
    console.log('%s %s %s', req.method, req.url, JSON.stringify(req.body));
    //console.log("myData = "+JSON.stringify(myData));
    next();
});


// get a particular item from the model
app.get('/model/:id', function(req, res) {
    var n = req.params.id;
    var item = null;
    for (var i = 0; i < myData.length; i++) {
        if (myData[i].id == n) item = myData[i];
    }
    res.json(200, item);
});


// get all items from the model
app.get('/shopping', function(req, res) {
    var collection = db.get('shopping');
    collection.find({}, {}, function(e, docs) {
        console.log(JSON.stringify(docs));
        res.json(200, docs);
    })
});

// change an item in the model
app.put('/shopping/:id', function(req, res) {
    var collection = db.get('shopping');
    collection.update({
        "_id": req.params.id
    }, req.body);
    res.json(200, {});
});

// add new item to the model
app.post('/shopping', function(req, res) {
    console.log("post ... " + JSON.stringify(req.body));
    var collection = db.get('shopping');
    collection.insert(req.body);
    res.json(200, {});
});

// delete a particular item from the model
app.delete('/shopping/:id', function(req, res) {
    var id = req.params.id;
    console.log("deleting " + id);
    var collection = db.get('shopping');
    collection.remove({
        _id: id
    });
    res.json(200, {});
});


// listen on port 3000
var port = 3000;
app.listen(port, function() {
    console.log("server is listening on port " + port);
});
