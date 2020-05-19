var express = require('express');
var settings = require('../../settings.js');
var router = express.Router();
var errors = require('../libs/errors');
module.exports = (function () {
    router.all('/:ifName',
        function (req, res) {
            var ifName = req.params.ifName;
            if (!ifName) res.send(404);
            function callback(_code, _err, _result) {
                res.send({code: _code, msg: _err, data: _result});
            }

            var errors = require('../libs/errors.js');
            var api = require('./api.js').GetApi(req, res, callback);
            try {
                if (api[ifName]) {
                    //if (req.session.WebUser || ifName == "UpLoad") {
                        api[ifName]();
                    //} else {
                    //    res.send({err: errors.NoLogin, success: false, data: null});
                    //}
                } else {
                    res.send({code: 50001, msg: errors[50001].name, data: ""});
                }
            } catch (_err) {
                console.log(_err);
                res.send({code: _err.code, msg: _err.msg, data: _err.data});
            }
        }
    );

    return router;

}).call(this);