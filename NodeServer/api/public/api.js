// var request = require('request');
//var EventProxy = require('eventproxy');
//var crypto = require('crypto');
var settings = require('../../settings.js');

exports.GetApi = function(_req, _res, _callback, _errors) {
    return {
        db: require('../libs/mysql.js'), //数据库连接属性
        req: _req,
        res: _res,
        cb: _callback,
        getParam: function(param, _code) {
            var code = _code || 4041;
            if (typeof(_req.query[param]) === "undefined" && typeof(_req.body[param]) === "undefined")
                throw code;
            else if (!_req.query[param])
                return _req.body[param];
            else
                return _req.query[param];
        },
        test: function() {
            this.cb(200,'ok');
        },
        caselist:function(){
            console.log("进入caselist");
            var Me=this;
            var cur_page = Me.getParam('cur_page');
            var limit = Me.getParam('page_num');

            var start=(cur_page-1)*limit;
            
            var sqlCmd = 'select * from users limit ?,?;';
            sqlCmd += "select count(0) as totalCount from users;";
            var sqlParams=[];
            sqlParams.push(start, limit);
            Me.db.query(sqlCmd,sqlParams, function (_err, _results) {
                if (!_err) {
                    return Me.cb(200, null, {"totalCount": _results[1][0].totalCount, 'topics': _results[0]});
                } else {
                    return cbError(50003, Me.cb);
                }
            });
        },
        picupload:function(){
            this.cb(200,'ok');
        }

    };
};