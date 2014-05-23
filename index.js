var express = require('express');
var engines = require('consolidate');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var uuid = require('node-uuid');
var config = require('./config');

var app = express();
app.engine('html', engines.dot);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));
app.use(cookieParser());
app.use(bodyParser());

var port = config.port || 3000;
var logToConsole = config.log.console || false;

var maps = {};
var users = {};
var colors = [
    'blue',
    'red',
//    'green',
    'pink',
    'black',
//    'yellow',
    'orange',
    'purple',
    'brown',
];

// setup rendering

var initiateMap = function(req, res) {
    res.redirect('/map/' + uuid.v4());
};

var forbidden = function(res, type, message) {
    if( type == 'json' ) {
        res.send(403, { error: message || 'Forbidden' });
    }
    else {
        res.send(403, message || 'Forbidden');
    }
};

var notFound = function(res, type, message) {
    if( type == 'json' ) {
        res.send(404, {error: message || 'Not found'});
    }
    else {
        res.send(404, message || 'Not found');
    }
};

var serverError = function(res, type, message) {
    if( type == 'json' ) {
        res.send(500, { error: message || 'Something blew up' });
    }
    else {
        res.send(500, message || 'Something blew up');
    }
};

var getCurrentMapData = function(map, req, res, callback) {

    var err = null;

    if( typeof map == 'string' ) {
        id = map;
        map = {
            id: id
        };
    }

    if( typeof maps[map.id] == 'undefined' ) {
        maps[map.id] = {
            id: map.id,
            mapboxId: config.mapbox.id,
            users: {}
        };
    }

    if( typeof maps[map.id].users[req.cookies.userid] == 'undefined' ) {
        maps[map.id].users[req.cookies.userid] = {
            point: []
        };
    }

    callback(err, maps[map.id]);

};

var renderMap = function(req, res){

    var map = {
        id: req.params.id
    };

    getCurrentMapData(map, req, res, function(err, map) {
        if( err ) {
            serverError(res);
        }
        else {
            if( map ) {
                map.userid = req.cookies.userid;
                res.render('map', map);
            }
            else {
                notFound(res);
            }
        }
    });

};

var logRequests = function(req, res, next) {
    console.log('%s %s', req.method, req.url);
    next();
};

var cookieData = function(req, res, next) {
    /*if( logToConsole ) {
        console.log(req.cookies);
    }*/

    var emptyUser = { name: '' , color: 'blue' };

    if( typeof req.cookies == 'undefined' || typeof req.cookies.userid == 'undefined') {
        // set user cookie
        var userId = uuid.v4();
        res.cookie('userid', userId);
        users[userId] = emptyUser;
    }
    else if( typeof users[req.cookies.userid] == 'undefined' ) {
        users[req.cookies.userid] = emptyUser;
    }

    next();
};

app.use(cookieData);

app.get('/', initiateMap);
app.get('/map', initiateMap);
app.get('/map/:id', renderMap);

app.get('/api/map/:id', function(req, res) {
    // Return data for map
    if( typeof maps[req.params.id] != 'undefined' ) {
        res.send(maps[req.params.id]);
    }
    else {
        notFound(res, 'json');
    }
});

app.get('/api/map/:id/geojson', function(req, res) {
    if( typeof maps[req.params.id] != 'undefined' ) {

        var keys = Object.keys(maps[req.params.id].users);
        var featureCollection = {
            type: 'FeatureCollection',
            features: [],
        };

        for(var i = 0, ii = keys.length; i < ii; i++) {

            if( typeof users[keys[i]] != 'undefined' ) {
                var feature = {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: maps[req.params.id].users[keys[i]].point
                    },
                    properties: {
                        color: users[keys[i]].color,
                        name: users[keys[i]].name
                    }
                };

                // only add features that has coordinates and is not the current users own feature
                if( keys[i] != req.cookies.userid && feature.geometry.coordinates.length == 2 ) {
                    featureCollection.features.push(feature);
                }
            }

        }

        res.send(featureCollection);
    }
    else {
        notFound(res, 'json');
    }
});

app.post('/api/map/:mapid/user/:userid', function(req, res) {
    // Set point for specified user on specified map
    var success = false;

    if( typeof maps[req.params.mapid] != 'undefined' && req.cookies.userid == req.params.userid ) {
        var latlng = req.body;
        maps[req.params.mapid].users[req.params.userid].point = [latlng.lng, latlng.lat];
        success = true;
    }

    res.send(200, {success: success});
});

app.get('/api/user/:id', function(req, res) {
    // Return a user
   if( typeof users[req.params.id] != 'undefined' ) {
        res.send(users[req.params.id]);
    }
    else {
        notFound(res, 'json');
    }
});

app.post('/api/user/:id/name/:name', function(req, res) {
    // Set name of user
    if( typeof users[req.params.id] == 'undefined' ) {
        notFound(res, 'json');
    }
    else if( req.cookies.userid == req.params.id ) {
        if( logToConsole ) {
            console.log('Setting name of %s to %s', req.params.id, req.params.name);
        }
        users[req.params.id].name = req.params.name;
    }
    else {
        forbidden(res, 'json');
    }
});

app.post('/api/user/:id/color', function(req, res) {
    if( typeof users[req.params.id] == 'undefined' ) {
        notFound(res, 'json');
    }
    else if( req.cookies.userid == req.params.id ) {
        var payload = req.body;

        if( colors.indexOf(payload.color) > -1) {
            if( logToConsole ) {
                console.log('Setting color of %s to %s', req.params.id, payload.color);
            }
            users[req.params.id].color = payload.color;
            res.send(200, {success:true});
        }
        else {
            forbidden(res, 'json');
        }
    }
    else {
        forbidden(res, 'json');
    }
});

if( logToConsole ) {
    app.use(logRequests);
}

app.listen(port);
console.log('Mapper server listening on port %s', port);
console.log('[Logging]\n Console: %s', logToConsole);