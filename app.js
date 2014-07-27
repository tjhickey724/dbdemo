#!/usr/bin/env node --harmony

/***
 firstServer.js
 This is a simple server illustrating middleware and basic REST functionality
 This demo also adds the mongo database connection, but everything is in one file
 on the server side. We will break this out so that it has model/view/controller on
 the server and client in the next demo...
 
 We have extended the example by using passportjs to get user authentication using google
 and to extend the example to store many people's shopping lists!
 
 The idea is to require authentication to use the app and then to use the authenticated id to
 lookup the user's shopping list ... this requires adding the user's "openID" field to the schema
 for the shopping collection...
 
 ***/

'use strict';
var express = require('express');
var bodyParser = require('body-parser'); // this allows us to pass JSON values to the server (see app.put below)
var app = express();

var monk = require('monk');
var db = monk('localhost:27017/shopping');
var User = db.get("user");

var cookieParser = require('cookie-parser');
var session = require('express-session');

var redisClient = require('redis').createClient();
var RedisStore = require('connect-redis')(session);


var passport = require('passport');
var GoogleStrategy = require('passport-google').Strategy;

var ensureAuthenticated = function(req, res, next) {
        if (req.isAuthenticated()) {
            console.log("req.user=" + JSON.stringify(req.user));
            return next();
        } else {
            res.redirect('/login.html');
        }
    };

passport.serializeUser(function(user, done) {
    //console.log("serializeUser: "+JSON.stringify(user));
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    //console.log("deserializeUser: "+JSON.stringify(obj));
    done(null, obj);
});


passport.use(new GoogleStrategy({
    returnURL: 'http://localhost:3000/auth/google/return',
    realm: 'http://localhost:3000/'
}, function(identifier, profile, done) {
    console.log("\nGoogleStrategy:\nidentifier=" + JSON.stringify(identifier) + "  profile=" + JSON.stringify(profile));
    User.find({
        openID: identifier
    }, function(err, user) {
        console.log("err = " + JSON.stringify(err) + "\n  user=" + JSON.stringify(user));
        if (user.length == 0) {
            // if this is the first visit for the user, then insert him/her into the database
            user = {};
            user.openID = identifier;
            user.profile = profile;
            //console.log("inserting user:"+ JSON.stringify(user));
            db.get("user").insert(user);
            //console.log("inserted user");
            done(null, user);
        } else {
            // the user has been here before and there should only be one user
            // matching the query (user[0]) so pass user[0] as user ...
            console.log("Google Strategy .. user = " + JSON.stringify(user));
            done(err, user[0]);
        }
    });
}));




// parse the bodies of all other queries as json
app.use(bodyParser.json());


// log the requests
app.use(function(req, res, next) {
    console.log('%s %s %s', req.method, req.url, JSON.stringify(req.body));
    //console.log("myData = "+JSON.stringify(myData));
    next();
});


// start using sessions...
//app.use(session({ secret: 'jfjfjfjf89fd89sd90s4j32kl' }));
app.use(cookieParser());
app.use(session({
    secret: 'unguessable',
    store: new RedisStore({
        client: redisClient
    })
}));

app.use(passport.initialize());
app.use(passport.session());


app.get('/auth/google/:return?', passport.authenticate('google', {
    successRedirect: '/',
    failureRedirect: '/login'
}));


// serve static content from the public folder 
app.use("/login.html", express.static(__dirname + '/public/login.html'));
app.use("/logout.html", express.static(__dirname + '/public/logout.html'));

// we require everyone to login before they can use the app!
app.use(ensureAuthenticated, function(req, res, next) {
    next()
});


// serve static content from the public folder 
app.use("/", express.static(__dirname + '/public'));

app.use("/secret", ensureAuthenticated, function(req, res) {
    res.redirect("http://www.brandeis.edu");
})


app.get('/auth/logout', function(req, res) {
    req.logout();
    res.redirect('/logout.html');
});




app.get('/api/user', ensureAuthenticated, function(req, res) {
    res.json(req.user);
});

app.get('/api/:name', function(req, res) {
    res.json(200, {
        "hello": req.params.name,
        "userid": req.user
    });
});


// get a particular item from the model
app.get('/model/:collection/:id', function(req, res) {
    var collection = db.get(req.params.collection);
    collection.find({
        _id: req.params.id
    }, {}, function(e, docs) {
        //console.log(JSON.stringify(docs));
        if (docs.length > 0) res.json(200, docs[0]);
        else res.json(404, {});
    })
});


// get all items from the model
app.get('/model/:collection', function(req, res) {
    var collection = db.get(req.params.collection);
    //console.log("app.get -- req.user=" + JSON.stringify(req.user));
    collection.find({
        openID: req.user.openID
    }, {}, function(e, docs) {
        //console.log(JSON.stringify(docs));
        res.json(200, docs);
    })
});

// change an item in the model
app.put('/model/:collection/:id', function(req, res) {
    var collection = db.get(req.params.collection);
    collection.update({
        "_id": req.params.id
    }, req.body);
    res.json(200, {});
});

// add new item to the model
// in this example we show how to use javascript promises
// to simply asynchronous calls
app.post('/model/:collection', function(req, res) {
    //console.log("post ... " + JSON.stringify(req.body));
    //console.log("post req.user=" + JSON.stringify(req.user));
    var collection = db.get(req.params.collection);
    var newItem = req.body;
    newItem.openID = req.user.openID;
    //console.log("post2 ... " + JSON.stringify(newItem));
    var promise = collection.insert(newItem);
    promise.success(function(doc) {
        res.json(200, doc)
    });
    promise.error(function(error) {
        res.json(404, error)
    });
});

// delete a particular item from the model
app.delete('/model/:collection/:id', function(req, res) {
    var id = req.params.id;
    //console.log("deleting " + id);
    var collection = db.get(req.params.collection);
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
