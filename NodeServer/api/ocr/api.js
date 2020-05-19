 var path = require('path');
var EventProxy = require('eventproxy');
var crypto = require('crypto');
var settings = require('../../settings.js');
var _errors = require('../libs/errors');
var hcUti = require('../libs/hcUti');
var File = require('../libs/File');
var path = require('path');
var request = require('request');

var fs = require('fs');
// var multer = require('multer');
// var upload = multer({dest: 'files/'});
// var instance = upload.single('logo');
var bodyParser = require('body-parser');



// var livedetect = tencentyoutuyun.livedetect;
var livedetect = require('../libs/tencentyoutuyun/livedetect');
var live_appid = settings.live_appid;
var live_secretId = settings.live_secretId;
var live_secretKey = settings.live_secretKey;
var live_userid = settings.live_userid;
var hosturl="127.0.0.1:4422";


var livedetect_conf = require('../libs/tencentyoutuyun/livedetect_conf');
// var livedetect_conf = tencentyoutuyun.livedetect_conf;
livedetect_conf.setAppInfo(live_appid, live_secretId, live_secretKey, live_userid, 0);
//新增
var auth = require('../libs/tencentyoutuyun/auth');
var conf = require('../libs/tencentyoutuyun/livedetect_conf');
// var conf = tencentyoutuyun.livedetect_conf;
conf.setAppInfo(live_appid, live_secretId, live_secretKey, live_userid, 0);
// 30 days
var EXPIRED_SECONDS = 2592000;
var expired = parseInt(Date.now() / 1000) + EXPIRED_SECONDS;
var sign  = auth.appSign2(conf, expired);



exports.GetApi = function(_req, _res, _callback, _errors) {
    return {
        db: require('../libs/mysql.js'), //数据库连接属性
        req: _req,
        res: _res,
        cb: _callback,
        getParam: function (param, _code) {
            var code = _code || 40002;
            if (typeof (_req.query[param]) === "undefined" && typeof (_req.body[param]) === "undefined")
                throw { code: code, msg: _errors[code].message, data: _errors[code].name };
            else if (!_req.query[param])
                return _req.body[param];
            else
                return _req.query[param];
        },
        test: function() {
            this.cb(200,'ok');
        },
        ocr:function(){
            var Me=this;
            var ep = new EventProxy();
            var idcard = Me.req.body.idcard;
            console.log(Me.req.body);
            var scantype = Me.req.body.scantype;
            var card_type=scantype-1;
            var orderno = Me.req.body.orderno;
            if(!orderno){
               return cbError(500012, Me.cb); 
            }
            var files = Me.req.files;
            var tmpFilePath = '';
            var fileid = 0;
            var OCRContent;
            var templateNo;
            console.log(Me.req.files.logo.path);
            // var userObj={
            //     username:"段茂",
            //     cardid: "429006199104156313"
            // }
            // Me.cb(200,null,userObj);
           // if(!data){
           //    var data=fs.readFileSync(path.join(__dirname, '1.jpg'));
           // }
            var temp_filepath = files.logo.path;
            var filename = temp_filepath.substring(temp_filepath.lastIndexOf('\\') + 1, temp_filepath.length);
            //var testdata=fs.readFileSync(path.join(__dirname, '1.jpg')).toString('base64');
            var data = fs.readFileSync(temp_filepath);
            
            var file = new File();
            var idcard="-1";
            var cardfrom="-1";
            var cardtime="-1";
            var username="业务员";
            var ocrType='idcard';
            var params = {
                uri: 'http://'+ conf.API_YOUTU_SERVER + '/ocr/' + ocrType,
                hostname: conf.API_YOUTU_SERVER,
                path: '/ocr/' + ocrType,
                method: 'POST',
                headers: {
                    'Authorization': sign,
                    'User-Agent'   : conf.USER_AGENT(),
                },
                formData:{
                  appid: conf.APPID,
                  image: data,
                  card_type:card_type
                }
            };

            request.post(params, function optionalCallback(err, httpResponse, body) {
                if (err) {
                    console.error('upload failed:', err);
                }
                // console.log('Upload successful!  Server responded with:', body);
                // return Me.cb(200,null,body);
                // Me.cb(200,null,body);
                console.log('idcard',JSON.parse(body).result_list[0].data);
                if(scantype==1){
                    idcard=JSON.parse(body).result_list[0].data.id;
                    username=JSON.parse(body).result_list[0].data.name;
                }else if(scantype==2){
                    cardfrom=JSON.parse(body).result_list[0].data.authority;
                    cardtime=JSON.parse(body).result_list[0].data.valid_date;
                }
                


                console.log('idcard',idcard)
              
                file.loadFile(temp_filepath,null,ep.done('loadFile'));     
            });
            ep.once('loadFile', function (result) {

                            

                                var filename = temp_filepath.substring(temp_filepath.lastIndexOf('\\') + 1, temp_filepath.length);
                                var employeePath = path.join(__dirname, '../../web/upload/images/');
                                var exceldir = employeePath;
                                var fullPath = '';
                                var file = new File();
                                var now = hcUti.formatDate(new Date(), 'yyyy-MM-dd');
                                tmpFilePath = idcard + '/';
                                exceldir +=idcard;
                                fullPath = File.joinfilePath([exceldir, filename]);
                        if (result) {
                            return file.createFile(result, exceldir, fullPath, ep.doneLater('createFile'));
                        }



                    });

                ep.once('createFile', function (result) {
                    // res.send("suc"); 
                    console.log("上传文件成功");
                    
                    ep.emit('select_pic');
                })
            ep.once('select_pic',function(){
                console.log('select_pic',orderno);
                 var sql_select="select * from ocrlog where orderno= ? and type= ?";
                 var sqlParams_select= [orderno,scantype];
                 Me.db.query(sql_select,sqlParams_select,function(err,result){
                    console.log(err);
                        if(err){
                            return;
                        }
                        if(result.length==0){
                          ep.emit('insert_pic');
                        }else{
                          ep.emit('update_pic');
                        }
                       
                });
                        
                        
            })
            ep.once('update_pic',function(){
                var result_path='upload/images/'+idcard+'/'+filename;
                var sql_update="UPDATE ocrlog SET filepath = ? WHERE orderno= ? and type= ? ";
                 var sqlParams_update= [result_path,orderno,scantype];
                 Me.db.query(sql_update,sqlParams_update,function(err,result){
                    console.log(err);
                        if(err){
                            return;
                        }
                    if(scantype==1){
                          var userObj={
                            name:username,
                            id: idcard,
                            path:result_path
                          }
                         Me.cb(200,null,userObj);
                        }else if(scantype==2){
                           var userObj={
                            cardfrom:cardfrom,
                            cardtime:cardtime,
                            path:result_path
                          }
                         Me.cb(200,null,userObj);
                        }else{
                          return cbError(40003, Me.cb);
                        }
                         
                       
                });
            })
            ep.once('insert_pic', function () {
                 var result_path='upload/images/'+idcard+'/'+filename;
                 var sql_insert="insert into ocrlog (type,idcard,filepath,orderno,name,cardfrom,cardtime) values (?,?,?,?,?,?,?)";
                 var sqlParams = [scantype,idcard,result_path,orderno,username,cardfrom,cardtime];
                 Me.db.query(sql_insert,sqlParams,function(err,result){
                    console.log(err);
                        if(err){
                            return;
                        }
                    if(scantype==1){
                          var userObj={
                            name:username,
                            id: idcard,
                            path:result_path
                          }
                         Me.cb(200,null,userObj);
                        }else if(scantype==2){
                           var userObj={
                            cardfrom:cardfrom,
                            cardtime:cardtime,
                            path:result_path
                          }
                         Me.cb(200,null,userObj);
                        }else{
                          return cbError(40003, Me.cb);
                    }
                         
                       
                });
                      
                      
            }) 


            },
        bank:function(){

            var Me=this;
            var ep = new EventProxy();
            var scantype=3;
            var idcard = Me.req.body.idcard;
            var orderno = Me.req.body.orderno;
               if(!orderno){
               return cbError(500012, Me.cb); 
            }
            var files = Me.req.files;
            var tmpFilePath = '';
            var fileid = 0;
            var OCRContent;
            var templateNo;
            // var data=fs.readFileSync(path.join(__dirname, '3.jpg')).toString('base64');
             var temp_filepath = files.logo.path;
            var filename = temp_filepath.substring(temp_filepath.lastIndexOf('\\') + 1, temp_filepath.length);
            var data = fs.readFileSync(temp_filepath);

            var ocrType='bankcard';
            var bankid='';
            var bankname='';
            var params = {
                uri: 'http://'+ conf.API_YOUTU_SERVER + '/ocr/' + ocrType,
                hostname: conf.API_YOUTU_SERVER,
                path: '/ocr/' + ocrType,
                method: 'POST',
                headers: {
                    'Authorization': sign,
                    'User-Agent'   : conf.USER_AGENT(),
                },
                formData:{
                  appid: conf.APPID,
                  image: data
                }
            };
            var file = new File();
            request.post(params, function optionalCallback(err, httpResponse, body) {
          
                
                if (err) {
                    console.error('upload failed:', err);
                }
               
                console.log('items',JSON.parse(body).data.items);

                bankid=JSON.parse(body).data.items[0].itemstring;
                bankname =JSON.parse(body).data.items[3].itemstring;
                

                file.loadFile(temp_filepath,null,ep.done('loadFile'));  

                // Me.cb(200,null,body);

              
            })
            ep.once('loadFile', function (result) {
                                var filename = temp_filepath.substring(temp_filepath.lastIndexOf('\\') + 1, temp_filepath.length);
                                var employeePath = path.join(__dirname, '../../web/upload/images/bank/');
                                var exceldir = employeePath;
                                var fullPath = File.joinfilePath([exceldir, filename]);;
                                var now = hcUti.formatDate(new Date(), 'yyyy-MM-dd');
                        
                        if (result) {
                            return file.createFile(result, exceldir, fullPath, ep.doneLater('createFile'));
                        }
                    });
            ep.once('createFile', function (result) {
                    // res.send("suc"); 
                    console.log("上传文件成功");
                    
                    ep.emit('select_pic');
            })
            
            // ep.once('insert_pic', function () {
            //      var result_path='upload/images/bank/'+filename;
            //      var sql_insert="insert into ocrlog (type,bankid,bankname,filepath,orderno) values (?,?,?,?,?)";
            //      var sqlParams = [3,bankid,bankname,result_path,orderno];
            //      Me.db.query(sql_insert,sqlParams,function(err,result){
            //         console.log(err);
            //             if(err){
            //                 return;
            //             }
            //              var userObj={
            //                 bankid:bankid,
            //                 bankname: bankname,
            //                 path:result_path
            //             }
            //             Me.cb(200,null,userObj);
                       
            //     });
            // }) 

            ep.once('select_pic',function(){
                console.log('select_pic',orderno);
                 var sql_select="select * from ocrlog where orderno= ? and type= ?";
                 var sqlParams_select= [orderno,scantype];
                 console.log(sql_select);
                 console.log(sqlParams_select);
                 Me.db.query(sql_select,sqlParams_select,function(err,result){
                    console.log(err);
                        if(err){
                            return;
                        }
                        if(result.length==0){
                          ep.emit('insert_pic');
                        }else{
                          ep.emit('update_pic');
                        }
                       
                });
                        
                        
            })
            ep.once('update_pic',function(){
                var result_path='upload/images/'+idcard+'/'+filename;
                var sql_update="UPDATE ocrlog SET filepath = ? WHERE orderno= ? and type= ? ";
                 var sqlParams_update= [result_path,orderno,scantype];

                 Me.db.query(sql_update,sqlParams_update,function(err,result){
                    console.log(err);
                        if(err){
                            return;
                        }
                        var userObj={
                            bankid:bankid,
                            bankname: bankname,
                            path:result_path
                        }
                        Me.cb(200,null,userObj);
                         
                       
                });
            })
            ep.once('insert_pic', function () {
                 var result_path='upload/images/bank/'+filename;
                 var sql_insert="insert into ocrlog (type,bankid,bankname,filepath,orderno) values (?,?,?,?,?)";
                 var sqlParams = [3,bankid,bankname,result_path,orderno];

                 console.log(sql_insert)
                 console.log(sqlParams)
                 Me.db.query(sql_insert,sqlParams,function(err,result){
                    console.log(err);
                        if(err){
                            return;
                        }
                         var userObj={
                            bankid:bankid,
                            bankname: bankname,
                            path:result_path
                        }
                        Me.cb(200,null,userObj);
                       
                });
            })  


        }
                
      
        


    };
};
function cbError(code, cb) {
    cb(code, _errors[code].message, _errors[code].name);
}