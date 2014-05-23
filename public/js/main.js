var mapDom = document.querySelector('#map');
var colorPickerDom = document.querySelector('#color-picker');

var config = {
    mapboxId: mapDom.getAttribute('data-mapbox-id'),
    mapId: mapDom.getAttribute('data-map-id'),
    userId: mapDom.getAttribute('data-user-id')
};

var map = L.mapbox.map('map', config.mapboxId);
var me = {};
var marker = null;
var templates = {};
var colorPickerData = {
    pins: []
};

var getUser = function(userid, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/user/' + userid, true);
    xhr.responseType = 'json';
    xhr.onload = function() {
        callback(this.response);
    };
    xhr.send();
};

getUser(config.userId, function(user) {
    me = user;
});

var pinColors = {
    blue: '0cbadf',     // foursquare blue
    red: 'ed1c16',      // coca-cola red
//    green: '7ab800',    // spotify green
    pink: 'ea4c89',     // dribbble pink
    black: '333',       // github black
//    yellow: 'f4b400',   // google yellow
    orange: 'ff6600',   // hacker news orange
    purple: '6441a5',   // twitch.tv purple
    brown: 'd5641c',    // etsy brown
};

var colorKeys = Object.keys(pinColors);

for(var i = 0, ii = colorKeys.length; i < ii; i++ ) {
    colorPickerData.pins.push({name: colorKeys[i], hex: pinColors[colorKeys[i]] });
}

templates.colorPicker = doT.template('<ul>{{~it.pins :pin}}<li class="color"><a href="#" data-color="{{=pin.name}}"><img src="http://a.tiles.mapbox.com/v3/marker/pin-m+{{=pin.hex}}.png" /></a></li>{{~}}</ul>');
templates.users = doT.template('<ul>{{~it.users :user}}<li class="user"><a href="#"><img src="http://a.tiles.mapbox.com/v3/marker/pin-m+{{=user.color.hex}}.png" />{{=user.name}}</a></li>{{~}}</ul>');
colorPickerDom.innerHTML = templates.colorPicker(colorPickerData);


var updateUserColor = function(color, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/user/' + config.userId + '/color', true);
    xhr.responseType = 'json';
    xhr.enctype = 'application/x-www-form-urlencoded';
    xhr.setRequestHeader("Content-type","application/x-www-form-urlencoded");
    xhr.onload = function() {
        if( typeof callback == 'function' ) {
            callback(this.response);
        }
    };
    xhr.send(serialize({color:color}));
};

var colorPickers = colorPickerDom.querySelectorAll('a');

for(var i = 0, ii = colorPickers.length; i < ii; i++ ) {
    colorPickers[i].addEventListener('click', function(e) {
        var color = this.getAttribute('data-color');

        if( typeof pinColors[color] != 'undefined' ) {
            updateUserColor(color);

            if( marker != null ) {
                marker.setIcon(L.mapbox.marker.icon({'marker-color': pinColors[color], 'marker-symbol': 'circle'}));
            }
        }
    });
}

console.log(colorPickers);

var run = function () {
    featureLayer.eachLayer(function(l) {
        l.feature.properties['marker-color'] = pinColors[l.feature.properties['color']];
        l.setIcon(L.mapbox.marker.icon(l.feature.properties));
    });

    window.setTimeout(function() {
        featureLayer.loadURL('/api/map/' + config.mapId + '/geojson');
    }, 2000);
};


// load featureLayer, and initiate a periodic fetch of the data
var featureLayer = L.mapbox.featureLayer()
    .loadURL('/api/map/' + config.mapId + '/geojson')
    .on('ready', run)
    .addTo(map);

var serialize = function(obj) {
    var str = [];
    
    for(var p in obj) {
        if (obj.hasOwnProperty(p)) {
            str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
        }
    }

    return str.join("&");
};

var updateUserPoint = function(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/map/' + config.mapId + '/user/' + config.userId, true);
    xhr.responseType = 'json';
    xhr.enctype = 'application/x-www-form-urlencoded';
    xhr.setRequestHeader("Content-type","application/x-www-form-urlencoded");
    xhr.onload = function() {
        if( typeof callback == 'function' ) {
            callback(this.response);
        }
    };
    xhr.send(serialize(marker._latlng));
};



if( marker == null ) {
    map.on('click', function(e){
        if( marker == null ) {
            marker = L.marker([e.latlng.lat, e.latlng.lng], {
                draggable: true,
                icon: L.mapbox.marker.icon({
                    'marker-color': pinColors[me.color],
                    'marker-symbol': 'circle'
                })
            }).addTo(map);

            marker.on('dragend', function(e) {
                updateUserPoint();
            });
        }
        else {
            marker.setLatLng(e.latlng);
        }

        updateUserPoint();
    });
}