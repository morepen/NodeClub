(function() {
    var app, cluster, express, session, http, i, numCPUs, path, routes, settings, os, _i, ipaddress;
    express = require('express');
    //session = require('express-session');
    routes = require('./routes/routes');
    http = require('http');
    path = require('path');
    cluster = require('cluster');
    settings = require('./settings.js');
    //numCPUs = require('os').cpus().length;
    numCPUs=1;

    if (cluster.isMaster) {
        console.log('master');
        for (i = _i = 0; 0 <= numCPUs ? _i < numCPUs : _i > numCPUs; i = 0 <= numCPUs ? ++_i : --_i) {
            cluster.fork();
        }
        cluster.on('exit', function(worker) {
            console.log('Worker ' + worker.id + ' died :(');
            return cluster.fork();
        });
    } else {
        app = express();
        app.set('port', settings.serverPort);
        app.set('views', __dirname + '/views');
        app.set('view engine', 'html');

        var bodyParser = require('body-parser');
        var cookieParser = require('cookie-parser');

        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: false }));
        app.use(cookieParser());
        app.use(express["static"](path.join(__dirname, 'web')));
        //app.use(session({ secret: settings.cookie_secret }));
		
		//解决跨域请求
	/*	app.all('*', function(req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "X-Requested-With,Content-Type");
            res.header("Access-Control-Allow-Methods","PUT,POST,GET,DELETE,OPTIONS");
            next();
        });*/

        routes(app);

        http.createServer(app).listen(app.get('port'), function() {
            var consoleDay = new Date();
            var consoleDayStr = consoleDay.getFullYear() + '-' + (consoleDay.getMonth() + 1) + '-' +
                consoleDay.getDate() + ' ' + consoleDay.getHours() + ":" +
                consoleDay.getMinutes() + ":" + consoleDay.getSeconds();
            return console.log('服务器启动 - 端口:[' + app.get('port') + '] 时间:[' + consoleDayStr + ']');
        });
    }
}).call(this);