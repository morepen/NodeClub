 var request = require('request');
//var EventProxy = require('eventproxy');
//var crypto = require('crypto');
var settings = require('../../settings.js');
var EventProxy = require('eventproxy');

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
        //测试接口
        sandbox:function(){
            var Me=this;
            var ep = new EventProxy();
            //console.log(Me.req.query);
            var applicantName = Me.req.body['applicantName']?Me.req.body['applicantName']:'-1'; //投保人姓名
            var applicantPhoneNo = Me.getParam('applicantPhoneNo'); //投保人手机号
            var applicantIdNo = Me.req.body['applicantIdNo']?Me.req.body['applicantIdNo']:'-1';//投保人证件号码            
            var insuredName = Me.req.body['insuredName']?Me.req.body['insuredName']:'-1';
            var insuredPhoneNo = Me.req.body['insuredPhoneNo']?Me.req.body['insuredPhoneNo']:'-1';
            var insuredIdNo = Me.req.body['insuredIdNo']?Me.req.body['insuredIdNo']:'-1';
            var plateNo = Me.req.body['plateNo']?Me.req.body['plateNo']:'-1';
            var vin = Me.req.body['vin']?Me.req.body['vin']:'-1';
            var registerDate = Me.req.body['registerDate']?Me.req.body['registerDate']:'-1';
            var payNo =Me.getParam('payNo');
            var bzPolicyNo = Me.req.body['bzPolicyNo']?Me.req.body['bzPolicyNo']:'-1';
            var tcPolicyNo = Me.req.body['tcPolicyNo']?Me.req.body['tcPolicyNo']:'-1';
            var accPolicyNo = Me.req.body['accPolicyNo']?Me.req.body['accPolicyNo']:'-1';
            var accPlanCode = Me.req.body['accPlanCode']?Me.req.body['accPlanCode']:'-1';
            var feeTotal = Me.req.body['feeTotal']?Me.req.body['feeTotal']:'-1';//保费合计总额
            var feeAuto = Me.req.body['feeAuto']?Me.req.body['feeAuto']:'-1';
            var feeTax = Me.req.body['feeTax']?Me.req.body['feeTax']:'-1';
            var feeAcc = Me.req.body['feeAcc']?Me.req.body['feeAcc']:'-1';
            var feeOther = Me.req.body['feeOther']?Me.req.body['feeOther']:'-1';
            var payEndDate = Me.req.body['payEndDate']?Me.req.body['payEndDate']:'-1';
            var payUrl = Me.req.body['payUrl']?Me.req.body['payUrl']:'-1';//支付链接
            var timestamp = Me.req.body['timestamp']?Me.req.body['timestamp']:'-1';
            var sign = Me.req.body['sign']?Me.req.body['sign']:'-1';
            var openid='-1';
            var insertId='';
            var sql="INSERT INTO applicantInfo (applicantName,applicantPhoneNoPost,applicantIdNoPost,insuredName,insuredPhoneNo,insuredIdNo,plateNo,vin,registerDate,payNo,bzPolicyNo,tcPolicyNo,accPolicyNo,accPlanCode,feeTotal,feeAuto,feeTax,feeAcc,feeOther,payEndDate,payUrl,timestamp1,sign) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);";
            var parmses=[applicantName,applicantPhoneNo,applicantIdNo,insuredName,insuredPhoneNo,insuredIdNo,plateNo,vin,registerDate,payNo,bzPolicyNo,tcPolicyNo,accPolicyNo,accPlanCode,feeTotal,feeAuto,feeTax,feeAcc,feeOther,payEndDate,payUrl,timestamp,sign];
            Me.db.query(sql,parmses,function(err,result){                    
                    if(!err){
                        insertId=result.insertId;
                        ep.emit('JmInfo');
                        return Me.res.send({code:0000,msg:'sus',data:""});
                        
                    }else{
                        console.log(err);
                        return Me.res.send({code:-200,msg:'sjk',data:""});
                    }                    
            });
            
            ep.once('JmInfo',function(){              
                //var sign_url="http://127.0.0.1:8080/Token/servlet/GetEncrypt";
                var sign_url=settings.sign_url;
                var parmses={
                     applicantPhoneNo:applicantPhoneNo,
                     applicantIdNo:applicantIdNo,
                     aesKey:settings.test_aesKey
                 }
                request.post(sign_url,{form:parmses},function(err,response,body){ 
                   if(body){
                    //console.log(body);
                    var selectTel=body.split(",")[0];
                    var selectCardId=body.split(",")[1];
                    //console.log("selectTel"+selectTel);
                    if(selectTel!=null&&selectTel!='null'){
                        
                      ep.emit('updateJm',selectTel,selectCardId);
                      ep.emit('getOpenid',selectTel);
                    }else{
                      ep.emit('updateResult',-4,"解密失败");
                    }



                   }else{
                      ep.emit('updateResult',-4,"解密失败");
                   }
                    
                    
                   
                })
            });
            ep.once('getOpenid',function(telephone){
                console.log("getOpenid");
                var sql="select openid from publicUser where telephone=? and bindState=1;";               
                Me.db.query(sql,[telephone],function(err,result){
                    //console.log(result.length);
                    if(!err){
                        
                        if(result.length>0){
                            openid=result[0].openid;
                            ep.emit('getToken');
                        }else{
                           
                           ep.emit('updateResult',-2,"未注册用户");
                        }
                    }else{
                         ep.emit('updateResult',-2,"未注册用户");
                    }
                });
            });
            ep.once('getToken',function(){
               var Me=this;
               //var url_getToken="http://10.187.231.220:807/wechat/image_upload";//henan
                var url_getToken=settings.url_getToken;

                var token="";
                request.get(url_getToken,{json:true},function(err,response,body){
                  
                    token=body.data;
                    ep.emit('sendTemplate',token);
                   });
                    ep.on('updateToken',function(){
                            request.get(url_getToken,{json:true},function(err,response,body){
                                token=body.data;
                                
                           });
                        });
            });
            
            ep.once('sendTemplate',function(token){
                var  url="https://api.weixin.qq.com/cgi-bin/message/template/send?access_token="+token;
                var feeTotal_text=feeTotal+"元";
                console.log(feeTotal_text+openid);
                var msg={
                    "touser":openid,
                    "template_id":"Lkd4qJ-a9ruX7WETW7Pqrk4QsmEqukmoBNxwSEXuUvQ",//hubei
                    "url":payUrl,
                    "topcolor":"#FF0000",
                    "data":{
                    "first": {
                    "value":"你好,你的车险订单尚未支付",
                    "color":"#173177"
                    },
                    "keyword1":{
                    "value":"太保车险",
                    "color":"#173177"
                    },
                    "keyword2":{
                    "value":feeTotal_text,
                    "color":"#173177"
                    },
                    "keyword3":{
                    "value":applicantName,
                    "color":"#173177"
                    },
                    "remark":{
                    "value":"点击详情可完成订单支付！",
                    "color":"#173177"
                    }
                    }
                    };
                request.post(url,{body:JSON.stringify(msg),headers:{ 'content-type':'application/json'},proxy:settings.proxy_url},function(err,response,body){
                    
                     
                     var _body={};
                     try{
                        _body=JSON.parse(body); 
                        if(_body.errcode=='43004'){
                          ep.emit('updateResult',-3,"未关注用户");
                        }else{
                          ep.emit('updateResult',1,"推送成功");  
                        }
                        
                     }catch(error){
                         console.log('errorlast:',error);
                         ep.emit('updateResult',-5,"微信服务器异常");
                         
                     }
                    
                }) 
            })
            
            ep.once('updateResult',function(state,StateText){
                var sql="UPDATE applicantInfo SET sendState=?,StateText=?,openid=? where id=?";               
                 Me.db.query(sql,[state,StateText,openid,insertId],function(err,result){
                    
                     if(err){
                       console.log(err);
                     }
                    
                    
                });
            }); 
            ep.once('updateJm',function(applicantPhoneNo,selectCardId){
                var sql="UPDATE applicantInfo SET applicantPhoneNo=?,applicantIdNo=? where id=?";               
                 Me.db.query(sql,[applicantPhoneNo,selectCardId,insertId],function(err,result){
                        
                     if(err){
                       console.log(err);
                     }
                    
                    
                });
            });    
        },
        //正式接口
        insurerspayment:function(){
            var Me=this;
            var ep = new EventProxy();
            //console.log(Me.req.query);
            var applicantName = Me.req.body['applicantName']?Me.req.body['applicantName']:'-1'; //投保人姓名
            var applicantPhoneNo = Me.getParam('applicantPhoneNo'); //投保人手机号
            var applicantIdNo = Me.req.body['applicantIdNo']?Me.req.body['applicantIdNo']:'-1';//投保人证件号码            
            var insuredName = Me.req.body['insuredName']?Me.req.body['insuredName']:'-1';
            var insuredPhoneNo = Me.req.body['insuredPhoneNo']?Me.req.body['insuredPhoneNo']:'-1';
            var insuredIdNo = Me.req.body['insuredIdNo']?Me.req.body['insuredIdNo']:'-1';
            var plateNo = Me.req.body['plateNo']?Me.req.body['plateNo']:'-1';
            var vin = Me.req.body['vin']?Me.req.body['vin']:'-1';
            var registerDate = Me.req.body['registerDate']?Me.req.body['registerDate']:'-1';
            var payNo =Me.getParam('payNo');
            var bzPolicyNo = Me.req.body['bzPolicyNo']?Me.req.body['bzPolicyNo']:'-1';
            var tcPolicyNo = Me.req.body['tcPolicyNo']?Me.req.body['tcPolicyNo']:'-1';
            var accPolicyNo = Me.req.body['accPolicyNo']?Me.req.body['accPolicyNo']:'-1';
            var accPlanCode = Me.req.body['accPlanCode']?Me.req.body['accPlanCode']:'-1';
            var feeTotal = Me.req.body['feeTotal']?Me.req.body['feeTotal']:'-1';//保费合计总额
            var feeAuto = Me.req.body['feeAuto']?Me.req.body['feeAuto']:'-1';
            var feeTax = Me.req.body['feeTax']?Me.req.body['feeTax']:'-1';
            var feeAcc = Me.req.body['feeAcc']?Me.req.body['feeAcc']:'-1';
            var feeOther = Me.req.body['feeOther']?Me.req.body['feeOther']:'-1';
            var payEndDate = Me.req.body['payEndDate']?Me.req.body['payEndDate']:'-1';
            var payUrl = Me.req.body['payUrl']?Me.req.body['payUrl']:'-1';//支付链接
            var timestamp = Me.req.body['timestamp']?Me.req.body['timestamp']:'-1';
            var sign = Me.req.body['sign']?Me.req.body['sign']:'-1';
            var openid='-1';
            var insertId='';
            var sql="INSERT INTO applicantInfo (applicantName,applicantPhoneNoPost,applicantIdNoPost,insuredName,insuredPhoneNo,insuredIdNo,plateNo,vin,registerDate,payNo,bzPolicyNo,tcPolicyNo,accPolicyNo,accPlanCode,feeTotal,feeAuto,feeTax,feeAcc,feeOther,payEndDate,payUrl,timestamp1,sign) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);";
            var parmses=[applicantName,applicantPhoneNo,applicantIdNo,insuredName,insuredPhoneNo,insuredIdNo,plateNo,vin,registerDate,payNo,bzPolicyNo,tcPolicyNo,accPolicyNo,accPlanCode,feeTotal,feeAuto,feeTax,feeAcc,feeOther,payEndDate,payUrl,timestamp,sign];
            Me.db.query(sql,parmses,function(err,result){                    
                    if(!err){
                        insertId=result.insertId;
                        ep.emit('JmInfo');
                        return Me.res.send({code:0000,msg:'sus',data:""});
                        
                    }else{
                        //console.log(err);
                        return Me.res.send({code:-200,msg:'err',data:""});
                    }                    
            });
            
            ep.once('JmInfo',function(){              
                //var sign_url="http://127.0.0.1:8080/Token/servlet/GetEncrypt";
                var sign_url=settings.sign_url;
                var parmses={
                     applicantPhoneNo:applicantPhoneNo,
                     applicantIdNo:applicantIdNo,
                     aesKey:settings.online_aesKey
                 }
                request.post(sign_url,{form:parmses},function(err,response,body){ 
                   if(body){
                    //console.log(body);
                    var selectTel=body.split(",")[0];
                    var selectCardId=body.split(",")[1];
                    //console.log("selectTel"+selectTel);
                    if(selectTel!=null&&selectTel!='null'){
                        
                      ep.emit('updateJm',selectTel,selectCardId);
                      ep.emit('getOpenid',selectTel);
                    }else{
                      ep.emit('updateResult',-4,"解密失败");
                    }



                   }else{
                      ep.emit('updateResult',-4,"解密失败");
                   }
                    
                    
                   
                })
            });
            ep.once('getOpenid',function(telephone){
                console.log("getOpenid");
                var sql="select openid from publicUser where telephone=? and bindState=1;";
               
                Me.db.query(sql,[telephone],function(err,result){
                    //console.log(result.length);
                    
                    if(result.length>0){
                        openid=result[0].openid;
                        ep.emit('getToken');
                    }else{
                       
                       ep.emit('updateResult',-2,"未注册用户");
                    }
                });
            });
            ep.once('getToken',function(){
                var Me=this;
                //var url_getToken="http://10.187.231.220:807/wechat/image_upload";//henan
                var url_getToken=settings.url_getToken;
                
                var token="";
                request.get(url_getToken,{json:true},function(err,response,body){
                  
                    token=body.data;
                    ep.emit('sendTemplate',token);
                   });
                    ep.on('updateToken',function(){
                            request.get(url_getToken,{json:true},function(err,response,body){
                                token=body.data;
                                
                           });
                        });
            });
            
            ep.once('sendTemplate',function(token){
                var  url="https://api.weixin.qq.com/cgi-bin/message/template/send?access_token="+token;
                var feeTotal_text=feeTotal+"元";
                console.log(feeTotal_text+openid);
                var msg={
                    "touser":openid,
                    "template_id":"Lkd4qJ-a9ruX7WETW7Pqrk4QsmEqukmoBNxwSEXuUvQ",//hubei
                    "url":payUrl,
                    "topcolor":"#FF0000",
                    "data":{
                    "first": {
                    "value":"你好,你的车险订单尚未支付",
                    "color":"#173177"
                    },
                    "keyword1":{
                    "value":"太保车险",
                    "color":"#173177"
                    },
                    "keyword2":{
                    "value":feeTotal_text,
                    "color":"#173177"
                    },
                    "keyword3":{
                    "value":applicantName,
                    "color":"#173177"
                    },
                    "remark":{
                    "value":"点击详情可完成订单支付！",
                    "color":"#173177"
                    }
                    }
                    };
                request.post(url,{body:JSON.stringify(msg),headers:{ 'content-type':'application/json'},proxy:settings.proxy_url},function(err,response,body){
                    
                     
                     var _body={};
                     try{
                        _body=JSON.parse(body); 
                        if(_body.errcode=='43004'){
                          ep.emit('updateResult',-3,"未关注用户");
                        }else{
                          ep.emit('updateResult',1,"推送成功");  
                        }
                        
                     }catch(error){
                         console.log('errorlast:',error);
                         ep.emit('updateResult',-5,"微信服务器异常");
                         
                     }
                    
                }) 
            })
            
            ep.once('updateResult',function(state,StateText){
                var sql="UPDATE applicantInfo SET sendState=?,StateText=?,openid=? where id=?";               
                 Me.db.query(sql,[state,StateText,openid,insertId],function(err,result){
                    
                     if(err){
                       console.log(err);
                     }
                    
                    
                });
            }); 
            ep.once('updateJm',function(applicantPhoneNo,selectCardId){
                var sql="UPDATE applicantInfo SET applicantPhoneNo=?,applicantIdNo=? where id=?";               
                 Me.db.query(sql,[applicantPhoneNo,selectCardId,insertId],function(err,result){
                        
                     if(err){
                       console.log(err);
                     }
                    
                    
                });
            });    
        } 
        
    };
};