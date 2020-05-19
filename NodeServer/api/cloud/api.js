var request = require('request');
var EventProxy = require('eventproxy');
//var crypto = require('crypto');
var settings = require('../../settings.js');
var FtpClient = require('ftp');
var fs = require('fs');

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
            this.cb(200, 'ok');
        },
        pushid: function() {
            this.cb(200, 'ok');
        }
    };
};

var db = require('../libs/mysql.js');

//引入AWS SDK包
var AWS = require('aws-sdk');

//创建s3对象
var s3 = new AWS.S3(settings.bucket);

//桶参数通用对象
var BucketParams = function() {
    return {
        Bucket: settings.bucket._bucket
    }
}

exports.Auto = function() {
    queryFiles();
}

function queryFiles() {
    //查出所有未上传，但nasid > 0 （ 云存储默认用 -3 ）的文件
    var sql = "select * from files where filepath != '' and (nasid != '99999' and nasid != '')";

    sql += " and userid = 152 ;"//测试

    db.query(sql, [], function(err, result) {
        if (err) {
            console.log(err);
            console.log("error : queryFiles / ", _consoleTime());
            return setTimeout(() => {
                queryFiles(); 
            }, settings.transfer_interval);
        } else {
            console.log("success : queryFiles / length = " + result.length);
            if (result.length > 0) {
                s3service(result,0);
            } else {
                return setTimeout(() => {
                    queryFiles(); 
                }, settings.transfer_interval);
            }
        }
    });
}

//传入文件对象，获取文件路径
function getFilePath(_file){
    return _file.userid+"/"+_file.filename.substr(23,4)+"/"
    +_file.filename.substr(27,2)+"/"+_file.filename.substr(29,2)+"/"+_file.filename;//'13/2019/02/03/RDZA201963280000000521_20190203180553109.jpg';
}

//s3文件传输服务
function s3service(files, index){
    console.log('files.length:',files.length,' - index:',index, ' - ',_consoleTime());
    if (files.length<=index){
        // console.log('files.length:',files.length);
        return setTimeout(() => {
            queryFiles(); 
        }, settings.transfer_interval);
    }
    var _file = files[index];

    var _ftpPath = getFilePath(_file);

    var ep = new EventProxy();

    var _s3Param = new BucketParams();
    _s3Param.Key = _ftpPath;
    
    //7.如果ep报错
    ep.fail(function(err){
        console.log('ep fail:',err);
        return setTimeout(() => {
            queryFiles(); 
        }, settings.transfer_interval);
    });

    //6.更新完成，启动下一次服务
    ep.once('next_file',function(){
        console.log(6);
        s3service(files,++index);
    });

    //5.更新数据库
    ep.once('update_mysql',function(){
        console.log(5);
        var sqlCmd = "update files set filepath=?,nasid=99999 where id=?";
        var sqlParams = ['s3/'+_ftpPath,_file.id];
        db.query(sqlCmd,sqlParams,ep.done('next_file'));
    });

    //4.ftp删除任务
    ep.once('ftp_delete',function(resp){
        console.log(4);
        var ftp = new FtpClient();
        ftp.on('ready', function() {
            ftp.delete('vod/'+_ftpPath,function(err, currentDir) {
                if (err) throw err;
                ftp.end();
                ep.emit('update_mysql');
            });
        });
        ftp.connect(settings.ftp);
    });

    //3.s3上传任务
    ep.once('s3_putObject',function(data){
        console.log(3);
        _s3Param.Body = data;
        _s3Param.ACL= "public-read";
        console.log('s3_param:',_s3Param);
        s3.putObject(_s3Param, ep.done('ftp_delete'));
    });

    //2.执行ftp get
    ep.once('ftp_get',function(){
        var ftp = new FtpClient();
        ftp.on('ready', function() {
            // console.log(3);
            ftp.get('vod/'+_ftpPath,function(err, stream) {
                console.log('path:','vod/'+_ftpPath);
                if (err) throw err;
                stream.once('close', function() { 
                    fs.readFile('./tmpFile.tmp',ep.done('s3_putObject'));
                    ftp.end();
                });
                stream.pipe(fs.createWriteStream('./tmpFile.tmp'));
                // stream.pipe(fs.createWriteStream('./tmpFile.tmp').on('finish',function(){
                //     fs.readFile('./tmpFile.tmp',ep.done('s3_putObject'));
                // }));
            });//ftp get
        });//ftp on ready
        ftp.connect(settings.ftp);
    });

    //1.检查
    s3.headObject(_s3Param, function(err, data) {
        if(err){
            if(err.code == "NotFound"){
                //如果云端不存在对应的文件
               console.log('NotFound');
               ep.emit('ftp_get');
            // return s3service(files,++index);
           } else {
            console.log('headObject err:',err);
            return s3service(files,++index);//跳过错误文件。
           }
        } else {
            console.log('HasFound');
        //    return s3service(files,++index);
            ep.emit('ftp_delete');//存在则开始删除本地文件并更新
        }
     });
}

function _consoleTime() {
    var consoleDay = new Date();
    var consoleDayStr = consoleDay.getFullYear() + '-' + (consoleDay.getMonth() + 1) + '-' +
        consoleDay.getDate() + ' ' + consoleDay.getHours() + ":" +
        consoleDay.getMinutes() + ":" + consoleDay.getSeconds();
    return consoleDayStr;
}