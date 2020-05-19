var express = require('express');
var router = express.Router();
var errors = require('../libs/errors.js');
module.exports = (function() {

    // 该路由使用的中间件
    // router.use(function timeLog(req, res, next) {
    //     console.log('Time: ', Date.now());
    //     next();
    // });

    // router.get('/',function (req,res,next) {
    //     res.send('ok');
    //     });

    router.all('/:ifName',
        function(req, res) {
            var ifName = req.params.ifName;
            var callback = function (code, data, msg) {
                /** 
                 * 返回结果说明：
                 * 当返回code为200时，证明请求成功
                 * 返回结果第二个字段为data字段，用于传输结果
                 * 返回结果第三个字段msg为返回的提示语，一般为空
                 * 当返回code非200是，证明请求有问题
                 * 用code字段去对应errors表中的枚举类型，具体展示错误信息及内容由libs/errors.js文件确定
                */
                if(code == 200){
                    res.send({code:code,msg:msg?msg:'',data:data});
                } else {
                    res.send({code:code,msg:errors[code].message,data:errors[code].name});
                }
            }
            var api = require('./api.js').GetApi(req,res,callback,errors);
            try {
                if(api[ifName]) {
                    api[ifName]();
                } else {
                    throw 4040;
                }
            } catch (code){
                console.log("code"+code);
                res.send({code:code,msg:errors[code].message,data:errors[code].name});
            }
        }
    );
    return router;
}).call(this);