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
        login: function() {
            this.cb(200,'ok');
        },
        pushid: function() {
            this.cb(200,'ok');
        },
        //查询案件信息
        queryTask: function() {
            var Me = this;
            var taskNo, carNo, taskEndTime, timeStamp, sign;
            taskNo = Me.getParam("taskNo", 40001);
            carNo = Me.getParam("carNo", 40002);
            timeStamp = Me.getParam("timeStamp", 40022);
            sign = Me.getParam("sign", 40023);

            //1、签名校验
            if (!checkSign(taskNo, carNo, timeStamp, sign)) {
                return cbError(50002, Me.cb);
            }

            //2、查询资料
            var sqlCmd_query = "select taskNo,carNo,taskStartTime,taskEndTime,insuranceNo," +
                "'中国人民财产保险股份有限公司' as insuranceCompany,insuranceAmount,'道路旅客运输承运人责任保险(ZJP)' as insuranceType,taskStatus " +
                " from tasks where taskNo = ? and carNo = ?;";
            var sqlCmd_query_params = [taskNo, carNo];

            Me.db.query(sqlCmd_query, sqlCmd_query_params, function(err, result) {
                if (err) {
                    return cbError(51001, Me.cb);
                } else {
                    if (result.length > 0)
                        return Me.cb(200, "", result[0]);
                    else
                        return cbError(43021, Me.cb)
                }
            });
        }
    };
};