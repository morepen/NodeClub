var EventProxy = require('eventproxy');
var settings = require('../../settings.js');
var _errors = require('../libs/errors');
var path = require('path');
var hcUti = require('../libs/hcUti');
var File = require('../libs/File');
var request = require('request');
var md5 = require("md5");
var fs = require('fs');
var phantom = require('phantom');

exports.GetApi = function (_req, _res, _callback) {
    return {
        db: require('../libs/mysql.js'),//数据库连接属性
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
        // 单证上传
        UpLoad: function () {
            var Me = this;
            var files = Me.req.files;
            var openid = Me.req.body.openid;
            var userid = 0;
            var ep = new EventProxy();
            var tmpFilePath = '';
            var fileid = 0;

            var OCRContent;
            var templateNo;

            // console.log('files:', files);
            var temp_filepath = files.file.path;
            var filename = temp_filepath.substring(temp_filepath.lastIndexOf('\\') + 1, temp_filepath.length);
            var employeePath = path.join(__dirname, '../../web/upload/images');
            var exceldir = employeePath;
            var fullPath = '';
            var file = new File();

            var sqlCmd = 'select * from publicuser where openid = ?;';
            var sqlParams = [openid];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    userid = _results[0].id;
                    var now = hcUti.formatDate(new Date(), 'yyyy/MM/dd');
                    tmpFilePath = now + '/' + userid + '/';
                    exceldir += '/' + now + '/' + userid;
                    fullPath = File.joinfilePath([exceldir, filename]);
                    ep.emit('ep_file');
                }
            })

            ep.once('ep_file', function () {
                file.loadFile(temp_filepath, null, ep.doneLater('loadFile'));
            });

            ep.once('loadFile', function (result) {
                if (result) {
                    return file.createFile(result, exceldir, fullPath, ep.doneLater('createFile'));
                }
            });

            ep.once('createFile', function (result) {
                if (result) {
                    ep.emit('ep_updatefile');
                    // ep.emit('ep_ocr');
                }
            });

            ep.fail(function (err) {
                return cbError('50003', Me.cb);
            });

            ep.once('ep_ocr', function () {
                var data = fs.readFileSync(fullPath);
                var base64 = new Buffer(data).toString('base64');
                // OCR校验单证类型
                // var url = 'http://o2-api-hc.onlyou.com/rest/1.0/ocr/fullpage/request.json';
                var url = 'http://192.168.1.44:8890/rest/1.0/ocr/fullpage/request.json';
                request.post(url, { form: { image: base64 } }, function (err, response, body) {
                    console.log('body:', body);
                    try {
                        OCRContent = JSON.parse(body);
                    }
                    catch (_err) {
                        return Me.cb(300, '无法识别此照片单证类型，请重新拍摄', null);
                    }
                    if (OCRContent.code != 'SUCCESS') {
                        return Me.cb(300, '无法识别此照片单证类型，请重新拍摄', null);
                    }
                    templateNo = OCRContent.templateNo;
                    if (!settings.templateObj[templateNo]) {
                        return Me.cb(300, '无法识别此照片单证类型，请重新拍摄', null);
                    }
                    ep.emit('ep_updatefile');
                });
            });

            ep.once('ep_updatefile', function () {
                var filepath = settings.url + tmpFilePath + filename;
                var sqlCmd = 'insert into claimfile (filename,filepath,OCRContent,filetype) values (?,?,?,?);';

                // OCRContent = '{"code":"SUCCESS","request_hash":"1e8ba8f3dc1f964cde47d93b78651d96","sdkType":null,"originalName":"","ip":"180.163.108.66","start":1546062492263,"path":"/home/tmpdir/4868fd22efcdacf4ae369ef9ba744f90.jpg","userName":"SYSTEM","templateNo":"SH_MED_ZYFP","success":true,"field_list":[{"text":"捌仟零伍元柒角整","text_category":"TotalAmountCap","rect":{"left":171,"top":463,"width":170,"height":24}},{"text":"张亦飞","text_category":"Name","rect":{"left":138,"top":196,"width":70,"height":25}},{"text":"上海长海医院","text_category":"Hospital","rect":{"left":127,"top":83,"width":103,"height":22}},{"text":"","text_category":"LeaveDate","rect":{"left":344,"top":171,"width":118,"height":21}},{"text":"612016597535","text_category":"InvoiceNo","rect":{"left":767,"top":123,"width":170,"height":23}},{"text":"8005.7","text_category":"TotalAmount","rect":{"left":844,"top":469,"width":78,"height":22}},{"text":"","text_category":"ArriveDate","rect":{"left":177,"top":172,"width":127,"height":21}},{"text":"中国人民解放军医打住院收费票据","text_category":"MedicalType","rect":{"left":302,"top":70,"width":422,"height":42}}],"rotate_angel":0}';
                // templateNo = 'SH_MED_ZYFP';

                var sqlParams = [filename, filepath, OCRContent, templateNo];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        fileid = _results.insertId;
                        return Me.cb(200, null, { 'filepath': filepath, 'fileid': fileid });
                    }
                });
            })
        },
        // 补充单证-查询已上传的单证
        GetUploaded: function () {
            var Me = this;
            var claimid = Me.getParam('claimid');
            var sqlCmd = 'select * from claimfile where cid=? and uploadstatus=1;';
            var sqlParams = [claimid];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    return Me.cb(200, "", _results);
                }
            });
        },
        // 补充单证-重传
        UpLoad2: function () {
            var Me = this;
            var files = Me.req.files;
            var openid = Me.req.body.openid;
            var userid = 0;
            var ep = new EventProxy();
            var tmpFilePath = '';
            var fileid = 0;

            var OCRContent;
            var templateNo;

            // console.log('files:', files);
            var temp_filepath = files.file.path;
            var filename = temp_filepath.substring(temp_filepath.lastIndexOf('\\') + 1, temp_filepath.length);
            var employeePath = path.join(__dirname, '../../web/upload/images');
            var exceldir = employeePath;
            var fullPath = '';
            var file = new File();

            var sqlCmd = 'select * from publicuser where openid = ?;';
            var sqlParams = [openid];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    userid = _results[0].id;
                    var now = hcUti.formatDate(new Date(), 'yyyy/MM/dd');
                    tmpFilePath = now + '/' + userid + '/';
                    exceldir += '/' + now + '/' + userid;
                    fullPath = File.joinfilePath([exceldir, filename]);
                    ep.emit('ep_file');
                }
            })

            ep.once('ep_file', function () {
                file.loadFile(temp_filepath, null, ep.doneLater('loadFile'));
            });

            ep.once('loadFile', function (result) {
                if (result) {
                    return file.createFile(result, exceldir, fullPath, ep.doneLater('createFile'));
                }
            });

            ep.once('createFile', function (result) {
                if (result) {
                    // ep.emit('ep_updatefile');
                    ep.emit('ep_updatefile');
                }
            });

            ep.fail(function (err) {
                return cbError('50003', Me.cb);
            });

            ep.once('ep_ocr', function () {
                var data = fs.readFileSync(fullPath);
                var base64 = new Buffer(data).toString('base64');
                // OCR校验单证类型
                var url = 'http://o2-api-hc.onlyou.com/rest/1.0/ocr/fullpage/request.json';
                request.post(url, { form: { image: base64 } }, function (err, response, body) {
                    console.log('body:', body);
                    try {
                        OCRContent = JSON.parse(body);
                    }
                    catch (_err) {
                        return Me.cb(300, '无法识别此照片单证类型，请重新拍摄', null);
                    }
                    if (OCRContent.code != 'SUCCESS') {
                        return Me.cb(300, '无法识别此照片单证类型，请重新拍摄', null);
                    }
                    templateNo = OCRContent.templateNo;
                    if (!settings.templateObj[templateNo]) {
                        return Me.cb(300, '无法识别此照片单证类型，请重新拍摄', null);
                    }
                    ep.emit('ep_updatefile');
                });
            });

            ep.once('ep_updatefile', function () {
                var filepath = settings.url + tmpFilePath + filename;
                var sqlCmd = 'insert into claimfile (filename,filepath,OCRContent,filetype) values (?,?,?,?);';

                // OCRContent = '{"code":"SUCCESS","request_hash":"1e8ba8f3dc1f964cde47d93b78651d96","sdkType":null,"originalName":"","ip":"180.163.108.66","start":1546062492263,"path":"/home/tmpdir/4868fd22efcdacf4ae369ef9ba744f90.jpg","userName":"SYSTEM","templateNo":"SH_MED_ZYFP","success":true,"field_list":[{"text":"捌仟零伍元柒角整","text_category":"TotalAmountCap","rect":{"left":171,"top":463,"width":170,"height":24}},{"text":"张亦飞","text_category":"Name","rect":{"left":138,"top":196,"width":70,"height":25}},{"text":"上海长海医院","text_category":"Hospital","rect":{"left":127,"top":83,"width":103,"height":22}},{"text":"","text_category":"LeaveDate","rect":{"left":344,"top":171,"width":118,"height":21}},{"text":"612016597535","text_category":"InvoiceNo","rect":{"left":767,"top":123,"width":170,"height":23}},{"text":"8005.7","text_category":"TotalAmount","rect":{"left":844,"top":469,"width":78,"height":22}},{"text":"","text_category":"ArriveDate","rect":{"left":177,"top":172,"width":127,"height":21}},{"text":"中国人民解放军医打住院收费票据","text_category":"MedicalType","rect":{"left":302,"top":70,"width":422,"height":42}}],"rotate_angel":0}';
                // templateNo = 'SH_MED_ZYFP';

                var sqlParams = [filename, filepath, OCRContent, templateNo];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        fileid = _results.insertId;
                        return Me.cb(200, null, { 'filepath': filepath, 'fileid': fileid });
                    }
                });
            })
        },
        // 补充单证-提交
        uploadToClaim: function () {
            var Me = this;
            var fileid = Me.getParam('fileid');
            var claimid = Me.getParam('claimid');
            var openid = Me.getParam('openid');
            var ep = new EventProxy();
            var auditrecords = [];

            var userid = '';
            var createtime = '';
            var username = '';
            var realname = '';
            var remark = '';
            var dealtype = 25;
            var beforestatus = 3;
            var afterstatus = 1;
            var firstaudituserid = 0;
            var secondaudituserid = 0;
            var threeaudituserid = 0;
            var status = 0;

            var sqlCmd = 'select * from claim where id=?;';
            var sqlParams = [claimid];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    if (_results[0].auditrecords) {
                        auditrecords = JSON.parse(_results[0].auditrecords);
                        firstaudituserid = auditrecords[0].firstaudituserid;
                        secondaudituserid = auditrecords[0].secondaudituserid;
                        threeaudituserid = auditrecords[0].threeaudituserid;
                    }
                    // 任务未被领取，应为待初审
                    // 任务已被领取，应为单证初审二次提交
                    console.log('_results[0].firstaudituserid:', _results[0].firstaudituserid);
                    if (_results[0].firstaudituserid == 0) {
                        status = 0;
                    }
                    else {
                        status = 2;
                    }
                    ep.emit('ep_query_publicuser');
                }
            });

            ep.once('ep_query_publicuser', function () {
                var sqlCmd = 'select * from publicuser where openid=?;';
                var sqlParams = [openid];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        auditrecords.push({
                            userid: openid,
                            createtime: new Date().getTime(),
                            username: username,
                            realname: _results[0].realname,
                            remark: remark,
                            dealtype: dealtype,
                            beforestatus: beforestatus,
                            afterstatus: status,
                            firstaudituserid: firstaudituserid,
                            secondaudituserid: secondaudituserid,
                            threeaudituserid: threeaudituserid
                        })
                        ep.emit('ep_update_claim');
                    }
                });
            });

            ep.once('ep_update_claim', function () {
                var sqlCmd = 'update claimfile set cid=? where id in (?);';
                sqlCmd += 'update claimfile set uploadstatus=-1 where status=? and cid=?;';
                sqlCmd += 'update claim set status=?,auditrecords=? where id=?;';
                var sqlParams = [claimid, JSON.parse(fileid), '退回', claimid, status, JSON.stringify(auditrecords), claimid];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        return Me.cb(200, "", _results);
                    }
                });
            })
        },
        // 单证删除
        Delete: function () {
            var Me = this;
            var fileid = Me.getParam('fileid');
            var filepath = Me.getParam('filepath');
            var ep = new EventProxy();
            console.log('fileid:', fileid);
            console.log('filepath:', filepath);

            var sqlCmd = 'select * from claimfile where id=? and filepath=?;';
            var sqlParams = [fileid, filepath];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    if (_results.length == 0) {
                        return Me.cb(300, "文件不存在", "");
                    }
                    else {
                        if (_results[0].cid) {    //文件已绑定
                            return Me.cb(300, "文件已上传，不能删除", "");
                        }
                        else {
                            return ep.emit('ep_delete');
                        }
                    }
                }
            });
            ep.once('ep_delete', function () {
                var sqlCmd = 'delete from claimfile where id = ?;';
                var sqlParams = [fileid];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        ep.emit('ep_unlink');
                    }
                });
            })
            ep.once('ep_unlink', function () {
                var path = filepath.replace(settings.url, 'web/upload/images/');
                console.log('path:', path);
                fs.unlink(path, function (err) {
                    if (err) {
                        console.log(err);
                        return cbError('50003', Me.cb);
                    }
                    else {
                        Me.cb(200, null, "");
                    }
                })
            })
        },
        // 获取用户的openid
        GetOpenid: function () {
            var Me = this;
            var appid = Me.getParam('appid');
            var secret = Me.getParam('secret');
            var js_code = Me.getParam('js_code');
            var url = 'https://api.weixin.qq.com/sns/jscode2session?appid=' + appid + '&secret=' + secret + '&js_code=' + js_code + '&grant_type=authorization_code'
            request(url, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    console.log(body) // 打印google首页
                    Me.cb(200, null, body);
                }
            })
        },
        // 查询微信id保单绑定的情况
        QueryBindInfo: function () {
            var Me = this;
            var ep = new EventProxy();
            var openid = Me.getParam('openid');
            var sqlCmd = 'select * from userpolicy as t1 left join publicuser as t2 on t1.uid = t2.id where t2.openid = ?;';
            var sqlParams = [openid];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    if (_results.length == 0) {
                        return Me.cb(200, "", 1);   //没有绑定保单
                    }
                    ep.emit('ep_query_policy');
                }
            });
            ep.once('ep_query_policy', function () {
                var now = hcUti.formatDate(new Date(), 'yyyy-MM-dd');
                // var sqlCmd = 'select * from userpolicy as t1 left join publicuser as t2 on t1.uid = t2.id where t2.openid = ? and t1.endtime >= ?;'
                var sqlCmd = 'select * from userpolicy as t1 left join publicuser as t2 on t1.uid = t2.id where t2.openid = ?;'
                // var sqlParams = [openid, now];
                var sqlParams = [openid];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        if (_results.length == 0) {
                            return Me.cb(200, "您所绑定的保单均以过保，请重新绑定", 2);   //绑定保单全部过保
                        }
                        return Me.cb(200, "", 3);   //绑定保单至少有一个未过保
                    }
                });
            })
        },
        // 绑定用户信息
        BindUser: function () {
            var Me = this;
            var ep = new EventProxy();
            var openid = Me.getParam('openid');
            var passtype = Me.getParam('passtype');
            var passno = Me.getParam('passno');
            var realname = Me.getParam('realname');
            var mobile = Me.getParam('mobile');
            var hrcode = Me.getParam('hrcode');
            var bankcard = Me.getParam('bankcard');
            var banktype = Me.getParam('banktype');
            var usertype = Me.getParam('usertype');
            var policyid = Me.getParam('policyid');
            policyid = JSON.parse(policyid);
            var insertId = 0;

            var sqlCmd = 'select * from publicuser where passtype=? and passno=? and realname=?;';
            var sqlParams = [passtype, passno, realname];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    if (_results.length) {
                        insertId = _results[0].id;
                        if (_results[0].openid != openid && _results[0].openid != "") {
                            return Me.cb(300, "此员工已被其它微信进行过绑定关联，不能再次进行绑定", "");
                        }
                        ep.emit('ep_update_publicuser');
                    }
                    else {
                        ep.emit('ep_insert');
                    }
                }
            });

            ep.once('ep_update_publicuser', function () {
                // 会有获取不到openid的情况
                if (!openid) {
                    return Me.cb(300, "未获取到用户信息，请稍后重试", "");
                }
                var sqlCmd = 'update publicuser set openid=?, mobile=?, hrcode=?, bankcard=?, banktype=?, usertype=? where id=?;';
                var sqlParams = [openid, mobile, hrcode, bankcard, banktype, usertype, insertId];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        ep.emit('ep_update');
                    }
                });
            });

            ep.once('ep_insert', function () {
                var sqlCmd = 'insert into publicuser (openid,passtype,passno,realname,mobile,hrcode,bankcard,banktype,usertype) values (?,?,?,?,?,?,?,?,?);';
                var sqlParams = [openid, passtype, passno, realname, mobile, hrcode, bankcard, banktype, usertype];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        insertId = _results.insertId;
                        ep.emit('ep_update');
                    }
                });
            });
            ep.once('ep_update', function () {
                var sqlCmd = 'update userpolicy set uid=? where id in (?);update publicuser set mobile=?,hrcode=?,bankcard=?,banktype=? where id=?;';
                var sqlParams = [insertId, policyid, mobile, hrcode, bankcard, banktype, insertId];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        return Me.cb(200, "", _results);
                    }
                });
            })
        },
        // 验证用户是否有可绑定的保单（未绑定过）
        VerifyUser: function () {
            var Me = this;
            var passtype = Me.getParam('passtype');
            var passno = Me.getParam('passno');
            var realname = Me.getParam('realname');
            var openid = Me.getParam('openid');
            var now = hcUti.formatDate(new Date(), 'yyyy-MM-dd');
            var ep = new EventProxy();

            var sqlCmd = 'select * from publicuser where openid <>"" and openid!=? and passtype=? and passno=? and realname=? and usertype=1;';
            var sqlParams = [openid, passtype, passno, realname];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    if (_results.length) {
                        return Me.cb(300, "此员工已被其它微信进行过绑定关联，不能再次进行绑定", "");
                    }
                    ep.emit('ep_query');
                }
            });
            ep.once('ep_query', function () {
                // var sqlCmd = 'select * from userpolicy where passtype=? and passno=? and realname=? and uid=0 and endtime >= ?;';
                // var sqlCmd = 'select userpolicy.* from userpolicy right JOIN clause on userpolicy.pid = clause.pid where userpolicy.passtype=? and userpolicy.passno=? and userpolicy.realname=? and userpolicy.endtime >= ? and userpolicy.uid=0 GROUP BY userpolicy.id;';
                var sqlCmd = 'select userpolicy.* from userpolicy right JOIN clause on userpolicy.pid = clause.pid and userpolicy.schemeid = clause.sid where userpolicy.passtype=? and userpolicy.passno=? and userpolicy.realname=? and userpolicy.uid=0 GROUP BY userpolicy.id;';
                // var sqlParams = [passtype, passno, realname, now];
                var sqlParams = [passtype, passno, realname];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        return Me.cb(200, "", _results);
                    }
                });
            });
        },
        // 验证用户是否有可绑定的保单（绑定的保单全部过保）
        VerifyUserByOpenId: function () {
            var Me = this;
            var openid = Me.getParam('openid');
            var ep = new EventProxy();
            var passtype = '';
            var passno = '';
            var realname = '';
            var now = hcUti.formatDate(new Date(), 'yyyy-MM-dd');

            var sqlCmd = 'select * from publicuser where openid=?;';
            var sqlParams = [openid];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    passtype = _results[0].passtype;
                    passno = _results[0].passno;
                    realname = _results[0].realname;
                    ep.emit('ep_query');
                }
            });
            ep.once('ep_query', function () {
                // var sqlCmd = 'select * from userpolicy where passtype=? and passno=? and realname=? and uid=0 and endtime >= ?;';
                // var sqlCmd = 'select userpolicy.* from userpolicy right JOIN clause on userpolicy.pid = clause.pid where userpolicy.passtype=? and userpolicy.passno=? and userpolicy.realname=? and userpolicy.endtime >= ? and userpolicy.uid=0 GROUP BY userpolicy.id;';
                var sqlCmd = 'select userpolicy.* from userpolicy right JOIN clause on userpolicy.pid = clause.pid where userpolicy.passtype=? and userpolicy.passno=? and userpolicy.realname=? and userpolicy.uid=0 GROUP BY userpolicy.id;';
                // var sqlParams = [passtype, passno, realname, now];
                var sqlParams = [passtype, passno, realname];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        return Me.cb(200, "", _results);
                    }
                });
            })
        },
        // 查询权益
        QueryRights: function () {
            var Me = this;
            var openid = Me.getParam('openid');
            var sqlCmd = 'select userpolicy.*,publicuser.mobile,baseclause.name from userpolicy left join publicuser on userpolicy.uid = publicuser.id left join clause on userpolicy.pid = clause.pid and userpolicy.schemeid = clause.sid left join baseclause on clause.cid = baseclause.id where publicuser.openid=? and clause.status=1 and baseclause.status=1;';
            var sqlParams = [openid];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    // 将返回的数据做处理
                    // return Me.cb(200, "", _results);
                    var result = [];
                    for (var i = 0; i < _results.length; i++) {
                        if (result.length == 0) {
                            result.push(_results[i]);
                            result[result.length - 1]['clause'] = [];
                            result[result.length - 1]['clause'].push(_results[i].name);
                        }
                        else {
                            if (result[result.length - 1].policyno == _results[i].policyno) {
                                result[result.length - 1]['clause'].push(_results[i].name);
                            }
                            else {
                                result.push(_results[i]);
                                result[result.length - 1]['clause'] = [];
                                result[result.length - 1]['clause'].push(_results[i].name);
                            }
                        }
                    }
                    return Me.cb(200, "", result);
                }
            });
        },
        // 查询权益
        QueryRights2: function () {
            var Me = this;
            var openid = Me.getParam('openid');
            var ep = new EventProxy();
            var result = [];
            var passno = '';
            var policynoArr = [];  //自己作为家属的保单号
            var passnoArr = [];
            var TotalData = [];

            // 查询作为家属涉及到的所有保单
            var sqlCmd = 'select userpolicy.* from userpolicy left join publicuser on userpolicy.uid = publicuser.id where publicuser.openid=? and userpolicy.character=2;';
            var sqlParams = [openid];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    for (var i = 0; i < _results.length; i++) {
                        policynoArr.push(_results[i].policyno);
                        passnoArr.push(_results[i].passno);
                        if (_results[i].belong) {
                            passnoArr.push(_results[i].belong);
                        }
                    }
                    if (_results.length > 0) {
                        ep.emit('ep_query_userpolicy');
                    }
                    else {
                        ep.emit('ep_query_userpolicy2');
                    }
                }
            });

            // 作为家属时的保单（查询员工信息）
            ep.once('ep_query_userpolicy', function () {
                console.log('ep_query_userpolicy:');
                var sqlCmd = 'select userpolicy.*,publicuser.mobile,baseclause.name from userpolicy left join publicuser on userpolicy.passno = publicuser.passno AND userpolicy.passtype = publicuser.passtype and userpolicy.realname = publicuser.realname left join clause on userpolicy.pid = clause.pid and userpolicy.schemeid = clause.sid left join baseclause on clause.cid = baseclause.id where userpolicy.policyno in (?) and userpolicy.passno in (?) and userpolicy.`character` = 1;';
                var sqlParams = [policynoArr, passnoArr];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        if (_results.length) {
                            TotalData = _results;
                        }
                        ep.emit('ep_query_nostaff');
                    }
                })
            });

            // 作为家属时的保单（员工信息不确定，也就是belong为空）
            ep.once('ep_query_nostaff', function () {
                var sqlCmd = 'select userpolicy.*,publicuser.mobile,baseclause.name from userpolicy left join publicuser on userpolicy.uid = publicuser.id left join clause on userpolicy.pid = clause.pid and userpolicy.schemeid = clause.sid left join baseclause on clause.cid = baseclause.id where publicuser.openid=? and clause.status=1 and baseclause.status=1 and userpolicy.`character`=2 and userpolicy.belong = "" GROUP BY userpolicy.id;';
                var sqlParams = [openid];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        if (_results.length) {
                            TotalData = TotalData.concat(_results);
                        }

                        ep.emit('ep_query_userpolicy2');
                    }
                })
            });

            // 作为员工时的保单（查询自己的信息）
            ep.once('ep_query_userpolicy2', function () {
                var sqlCmd = 'select userpolicy.*,publicuser.mobile,baseclause.name from userpolicy left join publicuser on userpolicy.uid = publicuser.id left join clause on userpolicy.pid = clause.pid and userpolicy.schemeid = clause.sid left join baseclause on clause.cid = baseclause.id where publicuser.openid=? and clause.status=1 and baseclause.status=1 and userpolicy.`character`=1;';
                var sqlParams = [openid];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        if (_results.length) {
                            TotalData = TotalData.concat(_results);
                            passnoArr.push(_results[0].passno);
                        }
                        // 将返回的数据做处理
                        for (var i = 0; i < TotalData.length; i++) {
                            if (result.length == 0) {
                                result.push(TotalData[i]);
                                result[result.length - 1]['clause'] = [];
                                result[result.length - 1]['clause'].push(TotalData[i].name);
                            }
                            else {
                                if (result[result.length - 1].policyno == TotalData[i].policyno) {
                                    result[result.length - 1]['clause'].push(TotalData[i].name);
                                }
                                else {
                                    result.push(TotalData[i]);
                                    result[result.length - 1]['clause'] = [];
                                    result[result.length - 1]['clause'].push(TotalData[i].name);
                                }
                            }
                        }
                        ep.emit('qp_query_knownfamily');
                    }
                })
            });

            ep.once('qp_query_passno', function () {
                var sqlCmd = 'SELECT userpolicy.* FROM userpolicy LEFT JOIN publicuser on userpolicy.uid = publicuser.id WHERE publicuser.openid=?;';
                var sqlParams = [openid];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        passno = _results[0].passno;
                        ep.emit('qp_query_knownfamily');
                    }
                })
            });

            ep.once('qp_query_knownfamily', function () {
                var sqlCmd = 'select userpolicy.*,publicuser.mobile from userpolicy left join publicuser on userpolicy.passno = publicuser.passno and userpolicy.passtype = publicuser.passtype and userpolicy.realname = publicuser.realname where userpolicy.character=2 and userpolicy.status=1 and userpolicy.belong in (?);';
                var sqlParams = [passnoArr];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        console.log('_results:', _results);
                        for (var i = 0; i < result.length; i++) {
                            for (var j = 0; j < _results.length; j++) {
                                if (result[i].policyno == _results[j].policyno) {
                                    var obj = {
                                        passtype: _results[j].passtype,
                                        passno: _results[j].passno,
                                        realname: _results[j].realname,
                                        mobile: _results[j].mobile
                                    }
                                    if (result[i]['knownfamily']) {
                                        result[i]['knownfamily'].push(obj);
                                    }
                                    else {
                                        result[i]['knownfamily'] = [];
                                        result[i]['knownfamily'].push(obj);
                                    }
                                }
                            }
                        }
                        return Me.cb(200, "", result);
                    }
                })
            })
        },
        // 查询用户的保单列表
        QueryPolicy: function () {
            var Me = this;
            var passtype = Me.getParam('passtype');
            var passno = Me.getParam('passno');
            var realname = Me.getParam('realname');
            var now = hcUti.formatDate(new Date(), 'yyyy-MM-dd');
            // var sqlCmd = 'select * from userpolicy where passtype=? and passno=? and realname=? and endtime >= ? and uid=0;';
            // var sqlCmd = 'select userpolicy.* from userpolicy right JOIN clause on userpolicy.pid = clause.pid where userpolicy.passtype=? and userpolicy.passno=? and userpolicy.realname=? and userpolicy.endtime >= ? and userpolicy.uid=0 GROUP BY userpolicy.id;';
            var sqlCmd = 'select userpolicy.* from userpolicy right JOIN clause on userpolicy.pid = clause.pid and userpolicy.schemeid = clause.sid where userpolicy.passtype=? and userpolicy.passno=? and userpolicy.realname=? and userpolicy.uid=0 GROUP BY userpolicy.id;';
            // var sqlParams = [passtype, passno, realname, now];
            var sqlParams = [passtype, passno, realname];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    return Me.cb(200, "", _results);
                }
            });
        },
        // 绑定家属
        BindFamily: function () {
            var Me = this;
            var passtype = Me.getParam('passtype');
            var passno = Me.getParam('passno');
            var realname = Me.getParam('realname');
            var mobile = Me.getParam('mobile');
            var policyid = Me.getParam('policyid');
            policyid = JSON.parse(policyid);
            var ep = new EventProxy();
            var obj = {
                passtype: passtype,
                passno: passno,
                realname: realname,
                mobile: mobile
            }

            var sqlCmd = 'select * from userpolicy where id in (?);';
            var sqlParams = [policyid];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    ep.emit('ep_update', _results);
                }
            });

            ep.once('ep_update', function (data) {
                // console.log('data:', data)
                var sqlCmd = '';
                var sqlParams = [];

                for (var i = 0; i < data.length; i++) {
                    var str = '';
                    var arr = [];
                    var family = data[i].family;
                    if (family == null || family == "") {
                        arr.push(obj);
                        str = JSON.stringify(arr);
                    }
                    else {
                        arr = JSON.parse(family);
                        arr.push(obj);
                        str = JSON.stringify(arr);
                    }
                    sqlCmd += 'update userpolicy set family=? where id=?;';
                    sqlParams.push(str);
                    sqlParams.push(data[i].id);
                }
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        return Me.cb(200, "", _results);
                    }
                });
            })
        },
        // 查询家属绑定的保单列表
        GetFamilyPolicy: function () {
            var Me = this;
            var openid = Me.getParam('openid');
            var ep = new EventProxy();
            var now = hcUti.formatDate(new Date(), 'yyyy-MM-dd');
            // var sqlCmd = 'select userpolicy.* from userpolicy left join publicuser on userpolicy.uid = publicuser.id where publicuser.openid=? and userpolicy.endtime >= ?;';
            var sqlCmd = 'select userpolicy.* from userpolicy left join publicuser on userpolicy.uid = publicuser.id where publicuser.openid=?;';
            // var sqlParams = [openid, now];
            var sqlParams = [openid];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    return Me.cb(200, "", _results);
                }
            });
        },
        // 解绑
        DisBind: function () {
            var Me = this;
            var policyid = Me.getParam('policyid');
            var familyid = Me.getParam('familyid');
            var policynum = Me.getParam('policynum');
            var ep = new EventProxy();
            var str = '';
            var uid = 0;
            // 删除本人
            if (familyid == 0) {
                var sqlCmd = 'select * from userpolicy where id=?;';
                var sqlParams = [policyid];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        uid = _results[0].uid;
                        ep.emit('ep_update_disbind');
                    }
                });
                ep.once('ep_update_disbind', function () {
                    var sqlCmd = 'update userpolicy set uid=0, family="" where id = ?;';
                    var sqlParams = [policyid];
                    if (policynum == 1) {
                        sqlCmd += 'update publicuser set openid="" where id=?;';
                        sqlParams.push(uid);
                    }

                    Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                        if (_err) {
                            return cbError('50003', Me.cb);
                        }
                        else {
                            return Me.cb(200, "", _results);
                        }
                    });
                });
            }
            // 解绑家属
            else {
                familyid--;
                var sqlCmd = 'select * from userpolicy where id = ?;';
                var sqlParams = [policyid];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        var family = _results[0].family;
                        var data = JSON.parse(family);
                        data.splice(familyid, 1);
                        str = JSON.stringify(data);
                        ep.emit('ep_update');
                    }
                });
                ep.once('ep_update', function () {
                    var sqlCmd = 'update userpolicy set family = ? where id = ?;';
                    var sqlParams = [str, policyid];
                    Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                        if (_err) {
                            return cbError('50003', Me.cb);
                        }
                        else {
                            return Me.cb(200, "", _results);
                        }
                    });
                })
            }
        },
        // 查询绑定的所有保单
        GetAllPolicy: function () {
            var Me = this;
            var openid = Me.getParam('openid');
            var sqlCmd = 'select userpolicy.*,publicuser.id as userid from userpolicy left join publicuser on userpolicy.uid = publicuser.id where publicuser.openid = ?;';
            var sqlParams = [openid];
            var ep = new EventProxy();
            var policyno = [];
            var result;
            var passno = '';
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    if (_results.length == 0) {
                        return Me.cb(300, "数据异常", "");
                    }
                    for (var i = 0; i < _results.length; i++) {
                        policyno.push(_results[i].policyno);
                    }
                    passno = _results[0].passno;
                    result = _results;
                    ep.emit('ep_query_userpolicy');
                }
            });
            ep.once('ep_query_userpolicy', function () {
                var sqlCmd = 'select userpolicy.*,publicuser.id as userid from userpolicy left join publicuser on userpolicy.passno = publicuser.passno and userpolicy.passtype = publicuser.passtype and userpolicy.realname = publicuser.realname where userpolicy.policyno in (?) and userpolicy.`character`=2 and userpolicy.status=1 and userpolicy.belong=?;';
                var sqlParams = [policyno, passno];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        result = result.concat(_results);
                        var OBJ = {};
                        for (var i = 0; i < result.length; i++) {
                            var key = result[i].policyno;
                            result[i]['register'] = [];
                            if (!OBJ[key]) {
                                OBJ[key] = result[i];
                            }
                            else {
                                OBJ[key]['register'].push({
                                    userid: result[i].userid,
                                    realname: result[i].realname,
                                    upid: result[i].id
                                })
                            }
                        }
                        result = [];
                        for (var k in OBJ) {
                            result.push(OBJ[k]);
                        }
                        return Me.cb(200, "", result);
                    }
                });
            })
        },
        // 查询本人的银行卡
        GetBankCard: function () {
            var Me = this;
            var openid = Me.getParam('openid');
            var sqlCmd = 'select * from publicuser where openid = ?;';
            var sqlParams = [openid];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    return Me.cb(200, "", _results);
                }
            });
        },
        // 申请理赔
        ApplyClaim: function () {
            var Me = this;
            var ep = new EventProxy();
            var openid = Me.getParam('openid');
            var upid = Me.getParam('upid');
            var familyid = Me.getParam('familyid');
            var familytype = Me.getParam('familytype');//me员工，register记名家属，unregister不记名家属
            var visittype = Me.getParam('visittype');
            var starttime = Me.getParam('starttime');
            var fileid = JSON.parse(Me.getParam('fileid'));
            var bank = Me.getParam('bank');
            var uid = 0;

            var insurant = '';
            if (familytype == 'me') {
                insurant = 'publicuser';
            }
            else if (familytype == 'register') {
                insurant = 'knownfamily';
            }
            else if (familytype == 'unregister') {
                insurant = 'family';
            }

            var posttime = new Date().getTime();
            var insurantid = 0;
            var familyinfo = '';
            var claimid = 0;
            var policyno = '';
            var todayNumber = 0;    //当日顺序码
            var policydate = '';
            var taskno = '';

            // 查询申请人uid
            var sqlCmd = 'select * from publicuser where openid = ?;';
            var sqlParams = [openid];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    uid = _results[0].id;
                    // 本人
                    if (familytype == 'me') {
                        insurantid = uid;
                    }
                    // 记名家属
                    else if (familytype == 'register') {
                        insurantid = familyid;
                    }
                    // 家属
                    ep.emit('ep_query');
                }
            });
            // 查询家属信息
            ep.once('ep_query', function () {

                var sqlCmd = 'select * from userpolicy where id = ?;';
                var sqlParams = [upid];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        policyno = _results[0].policyno;
                        // 不记名家属
                        if (familytype == 'unregister') {
                            familyid--;
                            var data = JSON.parse(_results[0].family);
                            var familyObj = data[familyid];
                            familyinfo = familyObj.passtype + '_' + familyObj.passno + '_' + familyObj.realname + '_' + familyObj.mobile;
                        }
                        return ep.emit('ep_create');
                    }
                });
            });

            // 生成任务号
            ep.once('ep_create', function () {
                policydate = policyno.substr(1, 3) + hcUti.formatDate(new Date(), 'yyyyMMdd');
                var sqlCmd = 'select count(*) as count from claim where policydate=?;';
                var sqlParams = [policydate];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        todayNumber = _results[0].count + 1;
                        // 顺序码
                        todayNumber = PrefixInteger(todayNumber, 5);
                        // 任务号
                        taskno = policydate + todayNumber;
                        ep.emit('ep_insert');
                    }
                });
            });
            ep.once('ep_insert', function () {
                var sqlCmd = 'insert into claim (uid,upid,insurant,insurantid,visittype,starttime,posttime,progress,familyinfo,bank,reportchannels,taskno,policydate) values (?,?,?,?,?,?,?,?,?,?,?,?,?);';
                var sqlParams = [uid, upid, insurant, insurantid, visittype, starttime, posttime, 0, familyinfo, bank, 1, taskno, policydate];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        claimid = _results.insertId;
                        return ep.emit('ep_updatefile');
                    }
                });
            });
            ep.once('ep_updatefile', function () {
                var sqlCmd = 'update claimfile set cid = ? where id in (?);';
                var sqlParams = [claimid, fileid];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        GetBankName(bank, claimid);
                        return Me.cb(200, "", _results);
                    }
                });
            })
        },
        // 查询理赔申请记录
        GetClaims: function () {
            var Me = this;
            var openid = Me.getParam('openid');
            var ep = new EventProxy();
            var uid = 0;

            var sqlCmd = 'select * from publicuser where openid=?;';
            var sqlParams = [openid];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    uid = _results[0].id;
                    ep.emit('ep_query_claim');
                }
            });
            ep.once('ep_query_claim', function () {
                var sqlCmd = 'select claim.*,publicuser.realname,publicuser.passno,userpolicy.character,userpolicy.policyno from claim left join publicuser on claim.insurantid = publicuser.id left join userpolicy on claim.upid = userpolicy.id where (claim.uid = ? and claim.reportchannels=1) or (claim.insurantid = ? or claim.uid = ? and claim.reportchannels in (2,3)) order by claim.posttime DESC;';
                var sqlParams = [uid, uid, uid];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        console.log('_err:', _err);
                        return cbError('50003', Me.cb);
                    }
                    else {
                        return Me.cb(200, "", _results);
                    }
                });
            })
        },
        // 查询理赔申请记录
        GetProgress: function () {
            var Me = this;
            var claimid = Me.getParam('claimid');
            var sqlCmd = 'select * from claim where id = ?;';
            var sqlParams = [claimid];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    return Me.cb(200, "", _results);
                }
            });
        },
        // 放弃理赔
        AbortClaim: function () {
            var Me = this;
            var claimid = Me.getParam('claimid');
            var ep = new EventProxy();
            var status;
            var auditrecords = [];
            var record;

            var sqlCmd = 'select * from claim where id=?;';
            var sqlParams = [claimid];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    status = _results[0].status;
                    if (_results[0].auditrecords) {
                        auditrecords = JSON.parse(_results[0].auditrecords);
                    }
                    record = _results[0];
                    ep.emit('ep_update_claim');
                }
            });

            ep.once('ep_update_claim', function () {
                var afterstatus = 27;
                var remark = '用户放弃索赔';
                var createtime = new Date().getTime();
                auditrecords.push({
                    afterstatus: afterstatus,
                    beforestatus: status,
                    createtime: createtime,
                    remark: remark,
                    realname: '',
                    userid: '',
                    username: ''
                })

                //2018-12-19 09:17添加 恢复之前预扣的理赔额度，和共享理赔额度
                var withholding, shareclause, userpolicy_id;
                withholding = record.withholding;
                shareclause = record.shareclause;
                userpolicy_id = record.upid;
                var RecoveryMoneyArr = RecoveryMoney(withholding, shareclause, userpolicy_id);
                var sqlCmd2 = "";
                var sqlParams2 = [];
                sqlCmd2 = RecoveryMoneyArr[0];
                sqlParams2 = RecoveryMoneyArr[1];


                var sqlCmd = 'update claim set status=?,updatetime=?,operatremark=?,auditrecords=? where id=?;';
                var sqlParams = [afterstatus, createtime, remark, JSON.stringify(auditrecords), claimid];

                //拼接
                sqlCmd = sqlCmd + sqlCmd2;
                sqlParams = sqlParams.concat(sqlParams2);

                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        return Me.cb(200, "", _results);
                    }
                });
            })
        },
        // 查询电话号码，hr号码，银行卡号
        QueryUserMobile: function () {
            var Me = this;
            var openid = Me.getParam('openid');
            var passno = Me.getParam('passno');
            var passtype = Me.getParam('passtype');
            var realname = Me.getParam('realname');
            var sqlCmd = 'select * from publicuser where passno=? and passtype=? and realname=?;';
            var sqlParams = [passno, passtype, realname];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    return Me.cb(200, "", _results);
                }
            });
        },
        // 修改电话号码
        ChangeMobile: function () {
            var Me = this;
            var policyid = Me.getParam('policyid');
            var usertype = Me.getParam('usertype');//1本人，2家属
            var newmobile = Me.getParam('newmobile');
            var passno = Me.getParam('passno');
            var openid = Me.getParam('openid');
            var ep = new EventProxy();
            var family;
            // usertype：1本人，2不记名家属，3记名家属
            if (usertype == 1 || usertype == 3) {
                var sqlCmd = 'update publicuser set mobile=? where passno=?;';
                var sqlParams = [newmobile, passno];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        return Me.cb(200, "", _results);
                    }
                });
            }
            else {
                var sqlCmd = 'select * from userpolicy where id=?;';
                var sqlParams = [policyid];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        family = _results[0].family;
                        ep.emit('ep_update');
                    }
                });
                ep.once('ep_update', function () {
                    var familyArr = JSON.parse(family);
                    for (var i = 0; i < familyArr.length; i++) {
                        if (familyArr[i].passno == passno) {
                            familyArr[i].mobile = newmobile;
                            break;
                        }
                    }
                    var sqlCmd = 'update userpolicy set family = ? where id=?;';
                    var sqlParams = [JSON.stringify(familyArr), policyid];
                    Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                        if (_err) {
                            return cbError('50003', Me.cb);
                        }
                        else {
                            return Me.cb(200, "", _results);
                        }
                    });
                })
            }
        },
        // 查询就诊日期
        GetVisitDate: function () {
            var Me = this;
            var policyid = Me.getParam('policyid');
            var sqlCmd = 'select * from userpolicy where id=?;';
            var sqlParams = [policyid];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    return Me.cb(200, "", _results);
                }
            });
        },
        //报案人拒绝 12：用户拒绝
        reporterRefuse: function () {
            console.log("进入接口-reporterRefuse");
            var Me, claim_id, remark, userid;
            Me = this;
            userid = Me.getParam("userid");
            claim_id = Me.getParam("claim_id");
            remark = Me.getParam("remark");
            //claim_userid = Me.getParam("claim_userid");//派发给的审核人员

            var ep = new EventProxy();

            var sqlCmd = "";
            var sqlParams = [];
            sqlCmd = "select * from claim where id = ?;";
            sqlParams = [claim_id];
            //console.log("reporterRefuse-sqlCmd:", sqlCmd);
            //console.log("reporterRefuse-sqlParams:", sqlParams);
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                //console.log("reporterRefuse-_err:", _err);
                //console.log("reporterRefuse-_results:", _results);
                if (_err) {
                    return cbError(50003, Me.cb);
                } else {
                    if (_results.length > 0) {
                        var claim_status = _results[0].status;
                        var flag = false;
                        if (claim_status == 14) {//status：14：复审通过
                            flag = true;
                        }
                        if (flag) {
                            ep.emit("_queryUserInfo", _results);
                            //ep.emit("_deal", _results);
                        } else {
                            //当前的任务状态不在操作范围内，请重新刷新页面
                            return cbError(80012, Me.cb);
                        }
                    } else {
                        //查询数据为空，不能进行操作，请重新刷新页面
                        return cbError(80010, Me.cb);
                    }
                }
            });

            ep.once("_queryUserInfo", function (ClaimData) {
                var reportchannels = ClaimData[0].reportchannels;//报案渠道(1：自助报案、2：HR代办、3：网点代办)
                var sqlCmd = "";
                var sqlParams = [];
                //if (reportchannels == 1) {
                sqlCmd = "select * from publicuser where openid = ?;";
                sqlParams.push(userid);
                //} else {
                //    sqlCmd = "select * from users where id = ?;";
                //    sqlParams.push(userid);
                //}
                Me.db.query(sqlCmd, sqlParams, function (err, result) {
                    if (err) {
                        return cbError(50003, Me.cb);
                    } else {
                        if (result.length > 0) {
                            var UserData = result[0];
                            ep.emit("_deal", ClaimData, UserData);
                        } else {
                            //查询数据为空，不能进行操作，请重新刷新页面
                            return cbError(80010, Me.cb);
                        }
                    }
                });
            });

            ep.on("_deal", function (ClaimData, UserData) {
                //console.log("_deal:", ClaimData);
                var record = ClaimData[0];
                var firstaudituserid = record.firstaudituserid;//初审人id
                var secondaudituserid = record.secondaudituserid;//复审人id
                var threeaudituserid = record.threeaudituserid;//高审人id
                var beforestatus = record.status;//操作之前的任务状态
                var afterstatus = 16;//操作之后的任务状态 status：16：报案人拒绝
                var secondauditcount = record.secondauditcount;///secondauditcount:复审（包括自动复审）通过且被报案人拒绝赔款确认书次数
                secondauditcount = secondauditcount + 1;
                var currenttime = new Date().getTime();
                var dealtype = 12;//dealtype；12：用户拒绝
                //var WebUser = Me.req.session.WebUser;
                //var userid = WebUser.id;
                var realname = "";
                var username = "";
                var reportchannels = ClaimData[0].reportchannels;//报案渠道(1：自助报案、2：HR代办、3：网点代办)
                if (reportchannels == 1) {
                    realname = UserData.realname;
                    userid = UserData.id;
                    username = "";
                } else {
                    realname = UserData.realname;
                    username = UserData.username;
                }
                var auditrecords = record.auditrecords;//记录字段
                if (auditrecords) {
                    try {
                        auditrecords = JSON.parse(auditrecords);
                    } catch (e) {
                        return cbError(50003, Me.cb);
                    }
                } else {
                    auditrecords = [];
                }
                var rec = {
                    userid: userid,
                    createtime: currenttime,
                    username: username,
                    realname: realname,
                    remark: remark,
                    dealtype: dealtype,
                    beforestatus: beforestatus,
                    afterstatus: afterstatus,
                    firstaudituserid: firstaudituserid,//初审人id
                    secondaudituserid: secondaudituserid,//复审人id
                    threeaudituserid: threeaudituserid//高审人id
                };
                auditrecords.push(rec);
                auditrecords = JSON.stringify(auditrecords);
                var auditrec = rec;
                var sqlCmd = "";
                var sqlParams = [];
                //ispushconfirmation：推送用户确认书（0：未推送，1：已推送等待确认，2：报案人同意，3：报案人拒绝，4：用户72小时为确认）
                //confirmtime：赔款确认书用户确认时间
                sqlCmd = "update claim set " +
                    "status=?,updatetime=?,operatremark=?,auditrecords=?,secondauditcount=? where id = ?;";
                sqlParams.push(auditrec.afterstatus, auditrec.createtime, auditrec.remark, auditrecords, secondauditcount, record.id);
                sqlCmd += "insert into confirmation_sms_logs (" +
                    "createtime,ispushconfirmation,confirmtime,claim_id,remark,secondauditcount" +
                    ") VALUES (" +
                    "?,?,?,?,?,?" +
                    ") ON DUPLICATE KEY update " +
                    "ispushconfirmation = ?,confirmtime=?,remark=?" +
                    ";";
                sqlParams.push(
                    currenttime, 3, currenttime, record.id, remark, secondauditcount,
                    3, currenttime, remark
                );

                //2018-12-19 09:17添加 恢复之前预扣的理赔额度，和共享理赔额度
                var withholding, shareclause, userpolicy_id;
                withholding = record.withholding;
                shareclause = record.shareclause;
                userpolicy_id = record.upid;
                var RecoveryMoneyArr = RecoveryMoney(withholding, shareclause, userpolicy_id);
                var sqlCmd2 = "";
                var sqlParams2 = [];
                sqlCmd2 = RecoveryMoneyArr[0];
                sqlParams2 = RecoveryMoneyArr[1];
                console.log('sqlCmd2:', sqlCmd2);
                console.log('sqlParams2:', sqlParams2);
                //拼接
                sqlCmd = sqlCmd + sqlCmd2;
                sqlParams = sqlParams.concat(sqlParams2);

                //console.log("_deal-sqlCmd:", sqlCmd);
                //console.log("_deal-sqlParams:", sqlParams);
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    //console.log("_deal-_err:", _err);
                    //console.log("_deal-_results:", _results);
                    if (_err) {
                        return cbError(50003, Me.cb);
                    } else {
                        return Me.cb(200, "处理任务成功", "OK");
                    }
                });
            });
        },
        //报案人同意 13：用户同意
        reporterAgree: function () {
            console.log("进入接口-reporterAgree");
            var Me, claim_id, remark, userid;
            Me = this;
            userid = Me.getParam("userid");
            claim_id = Me.getParam("claim_id");
            remark = Me.getParam("remark");
            //claim_userid = Me.getParam("claim_userid");//派发给的审核人员

            var ep = new EventProxy();

            var sqlCmd = "";
            var sqlParams = [];
            sqlCmd = "select * from claim where id = ?;";
            sqlParams = [claim_id];
            //console.log("reporterAgree-sqlCmd:", sqlCmd);
            //console.log("reporterAgree-sqlParams:", sqlParams);
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                //console.log("reporterAgree-_err:", _err);
                //console.log("reporterAgree-_results:", _results);
                if (_err) {
                    return cbError(50003, Me.cb);
                } else {
                    if (_results.length > 0) {
                        var claim_status = _results[0].status;
                        var flag = false;
                        if (claim_status == 14) {//status：14：复审通过
                            flag = true;
                        }
                        if (flag) {
                            ep.emit("_queryUserInfo", _results);
                        } else {
                            //当前的任务状态不在操作范围内，请重新刷新页面
                            return cbError(80012, Me.cb);
                        }
                    } else {
                        //查询数据为空，不能进行操作，请重新刷新页面
                        return cbError(80010, Me.cb);
                    }
                }
            });

            ep.once("_queryUserInfo", function (ClaimData) {
                var reportchannels = ClaimData[0].reportchannels;//报案渠道(1：自助报案、2：HR代办、3：网点代办)
                var sqlCmd = "";
                var sqlParams = [];
                //if (reportchannels == 1) {
                sqlCmd = "select * from publicuser where openid = ?;";
                sqlParams.push(userid);
                //} else {
                //    sqlCmd = "select * from users where id = ?;";
                //    sqlParams.push(userid);
                //}
                Me.db.query(sqlCmd, sqlParams, function (err, result) {
                    if (err) {
                        return cbError(50003, Me.cb);
                    } else {
                        if (result.length > 0) {
                            var UserData = result[0];
                            ep.emit("_deal", ClaimData, UserData);
                        } else {
                            //查询数据为空，不能进行操作，请重新刷新页面
                            return cbError(80010, Me.cb);
                        }
                    }
                });
            });

            ep.on("_deal", function (ClaimData, UserData) {
                //console.log("_deal:", ClaimData);
                var record = ClaimData[0];
                var firstaudituserid = record.firstaudituserid;//初审人id
                var secondaudituserid = record.secondaudituserid;//复审人id
                var threeaudituserid = record.threeaudituserid;//高审人id
                var beforestatus = record.status;//操作之前的任务状态
                var afterstatus = 15;//操作之后的任务状态 status：15：报案人接受
                var secondauditcount = record.secondauditcount;///secondauditcount:复审（包括自动复审）通过且被报案人拒绝赔款确认书次数
                var currenttime = new Date().getTime();
                var dealtype = 13;//dealtype；13：用户同意
                //var WebUser = Me.req.session.WebUser;
                //var userid = WebUser.id;
                var realname = "";
                var username = "";
                var reportchannels = ClaimData[0].reportchannels;//报案渠道(1：自助报案、2：HR代办、3：网点代办)
                if (reportchannels == 1) {
                    realname = UserData.realname;
                    userid = UserData.id;
                    username = "";
                } else {
                    realname = UserData.realname;
                    username = UserData.username;
                }
                var auditrecords = record.auditrecords;//记录字段
                if (auditrecords) {
                    try {
                        auditrecords = JSON.parse(auditrecords);
                    } catch (e) {
                        return cbError(50003, Me.cb);
                    }
                } else {
                    auditrecords = [];
                }
                var rec = {
                    userid: userid,
                    createtime: currenttime,
                    username: username,
                    realname: realname,
                    remark: remark,
                    dealtype: dealtype,
                    beforestatus: beforestatus,
                    afterstatus: afterstatus,
                    firstaudituserid: firstaudituserid,//初审人id
                    secondaudituserid: secondaudituserid,//复审人id
                    threeaudituserid: threeaudituserid//高审人id
                };
                auditrecords.push(rec);
                auditrecords = JSON.stringify(auditrecords);
                var auditrec = rec;
                var sqlCmd = "";
                var sqlParams = [];
                //ispushconfirmation：推送用户确认书（0：未推送，1：已推送等待确认，2：报案人同意，3：报案人拒绝，4：用户72小时为确认）
                //confirmtime：赔款确认书用户确认时间
                sqlCmd = "update claim set " +
                    "status=?,updatetime=?,operatremark=?,auditrecords=?,secondauditcount=?," +
                    "ispushconfirmation=?,confirmtime=? where id = ?;";
                sqlParams.push(
                    auditrec.afterstatus, auditrec.createtime, auditrec.remark, auditrecords, secondauditcount,
                    2, currenttime, record.id
                );
                sqlCmd += "insert into confirmation_sms_logs (" +
                    "createtime,ispushconfirmation,confirmtime,claim_id,remark,secondauditcount" +
                    ") VALUES (" +
                    "?,?,?,?,?,?" +
                    ") ON DUPLICATE KEY update " +
                    "ispushconfirmation = ?,confirmtime=?,remark=?" +
                    ";";
                sqlParams.push(
                    currenttime, 2, currenttime, record.id, remark, secondauditcount,
                    2, currenttime, remark
                );
                //console.log("_deal-sqlCmd:", sqlCmd);
                //console.log("_deal-sqlParams:", sqlParams);
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    //console.log("_deal-_err:", _err);
                    //console.log("_deal-_results:", _results);
                    if (_err) {
                        return cbError(50003, Me.cb);
                    } else {
                        return Me.cb(200, "处理任务成功", "OK");
                    }
                });
            });
        },
        // 获取理赔确认内容（姓名，银行卡号）
        GetCinfirm: function () {
            var Me = this;
            var claimid = Me.getParam('claimid');
            var sqlCmd = 'select claim.*,publicuser.realname from claim left join publicuser on claim.insurantid = publicuser.id where claim.id=?;';
            var sqlParams = [claimid];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    return Me.cb(200, "", _results);
                }
            });
        },

        // 下载理赔通知书
        DownloadNotice: function () {
            var Me = this;
            var claimid = Me.getParam('claimid');
            var ep = new EventProxy();
            var userpolicy_id = 0;
            var clause_id = [];         // 条款id
            var paymoney = {};          // 条款id对应的赔付金额
            var paymoneyByName = {};    // 条款名称对应的赔付金额
            var zymz_clause_id = {};    // 住院/门诊对应的id
            var Clause_Pic_Items = {};  // 第二个table用到的数据，对象数组形式
            var ClauseByName = {};      // 保单对应的条款信息
            var otherReduction = {};
            var taskno = '';
            var status = 0;
            var ispushconfirmation = 0;
            var cancel_status = 0;
            var claimStatus = 0;    //任务状态

            var html = '';
            html += '<!DOCTYPE html>';
            html += '<html lang="en">';
            html += '<head>';
            html += '<meta charset="UTF-8">';
            html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
            html += '<meta http-equiv="X-UA-Compatible" content="ie=edge">';
            html += '<title>理赔通知书</title>';
            html += '<style>';
            html += '* {margin: 0;padding: 0;box-sizing: border-box;}';
            html += '.clearfix {content: "";clear: both;display: block;overflow: hidden;}';
            html += '.msg p {width: 50%;float: left;}';
            html += 'h3 {text-align: center;}';
            html += 'p {line-height: 1.8;}';
            html += 'table {width: 100%;}';
            html += 'table td {padding: 10px 5px;}';
            html += '.table1 td {width: 20%;text-align: center;}';
            html += '.table2 td {width: 9.09%;text-align: center;}';
            html += '.table3 td {width: 33.33%;text-align: center;}';
            html += 'body,html{width: 1080px;margin: auto;padding-top:50px;}';
            html += '</style>';
            html += '</head>';
            html += '<body>';

            html += '<h2 style="margin:20px auto;text-align:center;">理赔通知书</h2>';

            var sqlCmd = 'select claim.*,enterprise.name as ename,userpolicy.policyno,userpolicy.character,userpolicy.belong,publicuser.hrcode,publicuser.realname,publicuser.passno,userpolicy.id as userpolicy_id ';
            sqlCmd += ' from claim LEFT JOIN publicuser on claim.insurantid = publicuser.id ';
            sqlCmd += ' LEFT JOIN userpolicy on claim.upid = userpolicy.id ';
            sqlCmd += ' LEFT JOIN enterprise on userpolicy.eid = enterprise.id ';
            sqlCmd += ' where claim.id=?;';
            var sqlParams = [claimid];
            Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                if (_err) {
                    return cbError('50003', Me.cb);
                }
                else {
                    var data = _results[0];
                    taskno = _results[0].taskno;
                    status = _results[0].status;
                    ispushconfirmation = _results[0].ispushconfirmation;
                    claimStatus = _results[0].status;

                    userpolicy_id = data.userpolicy_id;
                    // 理赔涉及到的条款
                    var withholding = [];
                    if (data.withholding) {
                        withholding = JSON.parse(data.withholding);
                    }
                    for (var i = 0; i < withholding.length; i++) {
                        clause_id.push(withholding[i].id);
                        paymoney[withholding[i].id] = withholding[i].deduction;
                    }
                    // console.log('character:', data.character);
                    // 1.员工替自己报案
                    if (data.insurant == 'publicuser' && data.character == 1) {
                        html += '<p style="margin-bottom:20px;">尊敬的 ' + data.realname + ' 女士/先生</p>';
                        html += '<p style="margin-bottom:10px;">您好！您的赔付申请我们已经收到，经过审慎核定您的申请资料，将本次理赔结果向您通知如下：</p>';

                        html += '<div class="msg clearfix"><p>申请号码：' + data.taskno + '</p><p>受理日期：' + hcUti.formatDate(new Date(data.posttime * 1), 'yyyy-MM-dd hh:mm:ss') + '</p></div>';
                        html += '<div class="msg clearfix"><p>保单号码：' + data.policyno + '</p><p>投保单位：' + data.ename + '</p></div>';
                        html += '<div style="width:100%;height:20px;"></div>';

                        html += '<div class="msg clearfix"><p>员工号：' + (data.hrcode ? data.hrcode : "") + '</p></div>';
                        html += '<div class="msg clearfix"><p>身份证号：' + data.passno + '</p><p>主被保险人：' + data.realname + '</p></div>';
                        html += '<div class="msg clearfix"><p>与主被保险人关系：本人</p></div>';
                        html += '<div style="width:100%;height:20px;"></div>';

                        html += '<div class="msg clearfix"><p>申请人：' + data.realname + '</p><p>与主被保险人关系：本人</p></div>';
                        var banknameStr = '';
                        if (data.bankname) {
                            banknameStr = data.bankname;
                        }
                        html += '<div class="msg clearfix"><p>开户行：' + banknameStr + '</p><p>领款人姓名：' + data.realname + '</p></div>';
                        html += '<div class="msg clearfix"><p>账号：' + data.bank + '</p></div>';

                        // 注销27，pdf模板2
                        if (claimStatus == 27) {
                            ep.emit('ep_getAllInvoice');
                        }
                        else {
                            html += '<div style="width:100%;height:20px;"></div>';
                            html += '<p>您本次申请赔付账单合计赔付金额：￥' + data.alltotal || 0 + '</p>';
                            html += '<div style="width:100%;height:20px;"></div>';
                            html += '<p>保单号：' + data.policyno + '，理赔概要如下：</p>';
                            // html += '<div style="width:100%;height:10px;"></div>';
                            ep.emit('ep_getclause');
                        }
                    }
                    // 2.员工替家属报案（不记名家属）
                    else if (data.insurant == 'family') {
                        ep.emit('ep_family', data);
                    }
                    // 3.员工替记名家属报案（记名家属且明确家属关系）
                    else if (data.insurant == 'knownfamily') {
                        ep.emit('ep_knownfamily', data);
                    }
                    // 4.家属替自己报案（记名家属且明确家属关系）
                    else if (data.insurant == 'publicuser' && data.character == 2 && data.belong) {
                        ep.emit('ep_publicuser_yes', data);
                    }
                    // 5.家属替自己报案（记名家属且未明确家属关系）
                    else if (data.insurant == 'publicuser' && data.character == 2 && data.belong == '') {
                        ep.emit('ep_publicuser_no', data);
                    }
                    // 特殊情况（判断出错）
                    else {
                        html += '<p style="margin-bottom:20px;">尊敬的 ' + data.realname + ' 女士/先生</p>';
                        html += '<p style="margin-bottom:10px;">您好！您的赔付申请我们已经收到，经过审慎核定您的申请资料，将本次理赔结果向您通知如下：</p>';

                        html += '<div class="msg clearfix"><p>申请号码：' + data.taskno + '</p><p>受理日期：' + hcUti.formatDate(new Date(data.posttime * 1), 'yyyy-MM-dd hh:mm:ss') + '</p></div>';
                        html += '<div class="msg clearfix"><p>保单号码：' + data.policyno + '</p><p>投保单位：' + data.ename + '</p></div>';
                        html += '<div style="width:100%;height:20px;"></div>';

                        html += '<div class="msg clearfix"><p>员工号：' + (data.hrcode ? data.hrcode : "") + '</p></div>';
                        html += '<div class="msg clearfix"><p>身份证号：' + data.passno + '</p><p>主被保险人：' + data.realname + '</p></div>';
                        html += '<div class="msg clearfix"><p>与主被保险人关系：本人</p></div>';
                        html += '<div style="width:100%;height:20px;"></div>';

                        html += '<div class="msg clearfix"><p>申请人：' + data.realname + '</p><p>与主被保险人关系：本人</p></div>';
                        var banknameStr = '';
                        if (data.bankname) {
                            banknameStr = data.bankname;
                        }
                        html += '<div class="msg clearfix"><p>开户行：' + banknameStr + '</p><p>领款人姓名：' + data.realname + '</p></div>';
                        html += '<div class="msg clearfix"><p>账号：' + data.bank + '</p></div>';

                        // 注销27，pdf模板2
                        if (claimStatus == 27) {
                            ep.emit('ep_getAllInvoice');
                        }
                        else {
                            html += '<div style="width:100%;height:20px;"></div>';
                            html += '<p>您本次申请赔付账单合计赔付金额：￥' + data.alltotal || 0 + '</p>';
                            html += '<div style="width:100%;height:20px;"></div>';
                            html += '<p>保单号：' + data.policyno + '，理赔概要如下：</p>';
                            ep.emit('ep_getclause');
                        }
                    }
                }
            });

            // 2.员工替家属报案（不记名家属）
            ep.once('ep_family', function (data) {
                // 1_420802000011112222_不记名家属_13564657464
                html += '<p style="margin-bottom:20px;">尊敬的 ' + data.familyinfo.split('_')[2] + ' 女士/先生</p>';
                html += '<p style="margin-bottom:10px;">您好！您的赔付申请我们已经收到，经过审慎核定您的申请资料，将本次理赔结果向您通知如下：</p>';

                html += '<div class="msg clearfix"><p>申请号码：' + data.taskno + '</p><p>受理日期：' + hcUti.formatDate(new Date(data.posttime * 1), 'yyyy-MM-dd hh:mm:ss') + '</p></div>';
                html += '<div class="msg clearfix"><p>保单号码：' + data.policyno + '</p><p>投保单位：' + data.ename + '</p></div>';
                html += '<div style="width:100%;height:20px;"></div>';

                var sqlCmd = 'SELECT * FROM `userpolicy` left JOIN publicuser on userpolicy.passno = publicuser.passno and userpolicy.passtype = publicuser.passtype and userpolicy.realname = publicuser.realname WHERE userpolicy.id=?;';
                var sqlParams = [data.upid];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        var res = _results[0];
                        html += '<div class="msg clearfix"><p>员工号：' + (res.hrcode ? res.hrcode : "") + '</p></div>';
                        html += '<div class="msg clearfix"><p>身份证号：' + data.familyinfo.split('_')[1] + '</p><p>主被保险人：' + res.realname + '</p></div>';
                        html += '<div class="msg clearfix"><p>与主被保险人关系：家属</p></div>';
                        html += '<div style="width:100%;height:20px;"></div>';

                        html += '<div class="msg clearfix"><p>申请人：' + res.realname + '</p><p>与主被保险人关系：本人</p></div>';
                        var banknameStr = '';
                        if (data.bankname) {
                            banknameStr = data.bankname;
                        }
                        html += '<div class="msg clearfix"><p>开户行：' + banknameStr + '</p><p>领款人姓名：' + data.familyinfo.split('_')[2] + '</p></div>';
                        html += '<div class="msg clearfix"><p>账号：' + data.bank + '</p></div>';

                        // 注销27，pdf模板2
                        if (claimStatus == 27) {
                            ep.emit('ep_getAllInvoice');
                        }
                        else {
                            html += '<div style="width:100%;height:20px;"></div>';
                            html += '<p>您本次申请赔付账单合计赔付金额：￥' + data.alltotal || 0 + '</p>';
                            html += '<div style="width:100%;height:20px;"></div>';
                            html += '<p>保单号：' + data.policyno + '，理赔概要如下：</p>';
                            ep.emit('ep_getclause');
                        }
                    }
                });
            });

            // 3.员工替家属报案（记名家属且明确家属关系）
            ep.once('ep_knownfamily', function (data) {

                var sqlCmd = 'SELECT publicuser.* FROM `userpolicy` left JOIN publicuser on userpolicy.belong = publicuser.passno WHERE userpolicy.id=?;';
                var sqlParams = [data.upid];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        var res = _results[0];
                        // data家属信息，res员工信息
                        html += '<p style="margin-bottom:20px;">尊敬的 ' + data.realname + ' 女士/先生</p>';
                        html += '<p style="margin-bottom:10px;">您好！您的赔付申请我们已经收到，经过审慎核定您的申请资料，将本次理赔结果向您通知如下：</p>';

                        html += '<div class="msg clearfix"><p>申请号码：' + data.taskno + '</p><p>受理日期：' + hcUti.formatDate(new Date(data.posttime * 1), 'yyyy-MM-dd hh:mm:ss') + '</p></div>';
                        html += '<div class="msg clearfix"><p>保单号码：' + data.policyno + '</p><p>投保单位：' + data.ename + '</p></div>';
                        html += '<div style="width:100%;height:20px;"></div>';

                        html += '<div class="msg clearfix"><p>员工号：' + (res.hrcode ? res.hrcode : "") + '</p></div>';
                        html += '<div class="msg clearfix"><p>身份证号：' + data.passno + '</p><p>主被保险人：' + res.realname + '</p></div>';
                        html += '<div class="msg clearfix"><p>与主被保险人关系：家属</p></div>';
                        html += '<div style="width:100%;height:20px;"></div>';

                        html += '<div class="msg clearfix"><p>申请人：' + res.realname + '</p><p>与主被保险人关系：本人</p></div>';
                        var banknameStr = '';
                        if (data.bankname) {
                            banknameStr = data.bankname;
                        }
                        html += '<div class="msg clearfix"><p>开户行：' + banknameStr + '</p><p>领款人姓名：' + data.realname + '</p></div>';
                        html += '<div class="msg clearfix"><p>账号：' + data.bank + '</p></div>';

                        // 注销27，pdf模板2
                        if (claimStatus == 27) {
                            ep.emit('ep_getAllInvoice');
                        }
                        else {
                            html += '<div style="width:100%;height:20px;"></div>';
                            html += '<p>您本次申请赔付账单合计赔付金额：￥' + data.alltotal || 0 + '</p>';
                            html += '<div style="width:100%;height:20px;"></div>';
                            html += '<p>保单号：' + data.policyno + '，理赔概要如下：</p>';
                            ep.emit('ep_getclause');
                        }
                    }
                });
            });

            // 4.家属替自己报案（记名家属且明确家属关系）
            ep.once('ep_publicuser_yes', function (data) {
                var sqlCmd = 'SELECT publicuser.* FROM `userpolicy` left JOIN publicuser on userpolicy.belong = publicuser.passno WHERE userpolicy.id=?;';
                var sqlParams = [data.upid];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        var res = _results[0];
                        // data家属信息，res员工信息
                        html += '<p style="margin-bottom:20px;">尊敬的 ' + data.realname + ' 女士/先生</p>';
                        html += '<p style="margin-bottom:10px;">您好！您的赔付申请我们已经收到，经过审慎核定您的申请资料，将本次理赔结果向您通知如下：</p>';

                        html += '<div class="msg clearfix"><p>申请号码：' + data.taskno + '</p><p>受理日期：' + hcUti.formatDate(new Date(data.posttime * 1), 'yyyy-MM-dd hh:mm:ss') + '</p></div>';
                        html += '<div class="msg clearfix"><p>保单号码：' + data.policyno + '</p><p>投保单位：' + data.ename + '</p></div>';
                        html += '<div style="width:100%;height:20px;"></div>';

                        html += '<div class="msg clearfix"><p>员工号：' + (res.hrcode ? res.hrcode : "") + '</p></div>';
                        html += '<div class="msg clearfix"><p>身份证号：' + data.passno + '</p><p>主被保险人：' + res.realname + '</p></div>';
                        html += '<div class="msg clearfix"><p>与主被保险人关系：家属</p></div>';
                        html += '<div style="width:100%;height:20px;"></div>';

                        html += '<div class="msg clearfix"><p>申请人：' + data.realname + '</p><p>与主被保险人关系：家属</p></div>';
                        var banknameStr = '';
                        if (data.bankname) {
                            banknameStr = data.bankname;
                        }
                        html += '<div class="msg clearfix"><p>开户行：' + banknameStr + '</p><p>领款人姓名：' + data.realname + '</p></div>';
                        html += '<div class="msg clearfix"><p>账号：' + data.bank + '</p></div>';

                        // 注销27，pdf模板2
                        if (claimStatus == 27) {
                            ep.emit('ep_getAllInvoice');
                        }
                        else {
                            html += '<div style="width:100%;height:20px;"></div>';
                            html += '<p>您本次申请赔付账单合计赔付金额：￥' + data.alltotal || 0 + '</p>';
                            html += '<div style="width:100%;height:20px;"></div>';
                            html += '<p>保单号：' + data.policyno + '，理赔概要如下：</p>';
                            ep.emit('ep_getclause');
                        }
                    }
                });
            });

            // 5.家属替自己报案（记名家属且未明确家属关系）
            ep.once('ep_publicuser_no', function (data) {

                html += '<p style="margin-bottom:20px;">尊敬的 ' + data.realname + ' 女士/先生</p>';
                html += '<p style="margin-bottom:10px;">您好！您的赔付申请我们已经收到，经过审慎核定您的申请资料，将本次理赔结果向您通知如下：</p>';

                html += '<div class="msg clearfix"><p>申请号码：' + data.taskno + '</p><p>受理日期：' + hcUti.formatDate(new Date(data.posttime * 1), 'yyyy-MM-dd hh:mm:ss') + '</p></div>';
                html += '<div class="msg clearfix"><p>保单号码：' + data.policyno + '</p><p>投保单位：' + data.ename + '</p></div>';
                html += '<div style="width:100%;height:20px;"></div>';

                html += '<div class="msg clearfix"><p>员工号：' + '' + '</p></div>';
                html += '<div class="msg clearfix"><p>身份证号：' + data.passno + '</p><p>主被保险人：' + data.realname + '</p></div>';
                html += '<div class="msg clearfix"><p>与主被保险人关系：本人</p></div>';
                html += '<div style="width:100%;height:20px;"></div>';

                html += '<div class="msg clearfix"><p>申请人：' + data.realname + '</p><p>与主被保险人关系：本人</p></div>';
                var banknameStr = '';
                if (data.bankname) {
                    banknameStr = data.bankname;
                }
                html += '<div class="msg clearfix"><p>开户行：' + banknameStr + '</p><p>领款人姓名：' + data.realname + '</p></div>';
                html += '<div class="msg clearfix"><p>账号：' + data.bank + '</p></div>';

                // 注销27，pdf模板2
                if (claimStatus == 27) {
                    ep.emit('ep_getAllInvoice');
                }
                else {
                    html += '<div style="width:100%;height:20px;"></div>';
                    html += '<p>您本次申请赔付账单合计赔付金额：￥' + data.alltotal || 0 + '</p>';
                    html += '<div style="width:100%;height:20px;"></div>';
                    html += '<p>保单号：' + data.policyno + '，理赔概要如下：</p>';
                    ep.emit('ep_getclause');
                }
            });

            // 理赔查询条款
            ep.once('ep_getclause', function () {
                var sqlCmd = 'SELECT policy_clause_amount.*,clause.formula ';
                sqlCmd += ' FROM `policy_clause_amount` LEFT JOIN clause on policy_clause_amount.clause_id = clause.id';
                sqlCmd += ' WHERE policy_clause_amount.userpolicy_id=? and policy_clause_amount.clause_id in (?);';
                var sqlParams = [userpolicy_id, clause_id];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        var data = _results;

                        // 理赔状态
                        var statusStr = '';
                        // 结案赔付/注销/拒绝赔付
                        if (status == 15 || status == 19 || (status == 14 && ispushconfirmation == 4)) {
                            statusStr = '结案赔付';
                        }
                        else if (status == 27 && cancel_status == 1) {
                            statusStr = '拒绝赔付';
                        }
                        else {
                            statusStr = '注销';
                        }

                        html += '<table border="1" cellpadding="0" cellspacing="0" class="table1">';
                        html += '<tr><td>赔付责任</td><td>理赔结论</td><td>赔付金额</td><td>理赔说明</td><td>本保单已累计赔付金额</td></tr>';
                        // 住院/门诊
                        for (var i = 0; i < data.length; i++) {
                            if (data[i].formula == 4 || data[i].formula == 5) {
                                continue;
                            }

                            // 本保单已累计赔付金额
                            var grandtotal = 0;
                            grandtotal = data[i].count * 1 - data[i].amount * 1;
                            grandtotal = grandtotal.toFixed(2);
                            html += '<tr><td>' + data[i].clause_name + '</td>';
                            html += '<td>' + statusStr + '</td>';
                            html += '<td>￥' + paymoney[data[i].clause_id] || 0 + '</td>';
                            html += '<td>补充医疗保险条款详见赔付明细</td>';
                            html += '<td>￥' + grandtotal || 0 + '</td></tr>';
                            paymoneyByName[data[i].clause_name] = paymoney[data[i].clause_id];
                        }
                        // 津贴
                        for (var i = 0; i < data.length; i++) {
                            if (data[i].formula == 1 || data[i].formula == 2 || data[i].formula == 3 || data[i].formula == 6) {
                                continue;
                            }
                            // 本保单已累计赔付金额
                            var grandtotal = 0;
                            grandtotal = data[i].count * 1 - data[i].amount * 1;
                            grandtotal = grandtotal.toFixed(2);
                            html += '<tr><td>' + data[i].clause_name + '</td>';
                            html += '<td>' + statusStr + '</td>';
                            html += '<td>￥' + paymoney[data[i].clause_id] || 0 + '</td>';
                            html += '<td>津贴给付</td>';
                            html += '<td>￥' + grandtotal || 0 + '</td></tr>';
                        }
                        html += '</table>';
                        ep.emit('ep_query_clause');
                    }
                });
            });

            ep.once('ep_query_clause', function () {
                var sqlCmd = 'select clause.*,baseclause.name from userpolicy left join clause on userpolicy.schemeid = clause.sid left join baseclause on clause.cid = baseclause.id where userpolicy.id=?;';
                var sqlParams = [userpolicy_id];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        var data = _results;
                        for (var i = 0; i < data.length; i++) {
                            ClauseByName[data[i].name] = data[i];
                        }
                        ep.emit('ep_getpic');
                    }
                })
            });

            ep.once('ep_getpic', function () {
                var sqlCmd = 'select claimfile.*,claim.otherReduction ';
                sqlCmd += ' from claimfile left join claim on claimfile.cid = claim.id ';
                sqlCmd += ' where claimfile.cid=? and claimfile.filetype in (?);';
                var sqlParams = [claimid, ["SH_MED_MZFP", "SH_MED_ZYFP"]];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        // console.log('_results:', _results);
                        html += '<div style="width:100%;height:30px;"></div>';
                        html += '<p>补充医疗保险条款赔付明细如下：</p>';
                        // html += '<div style="width:100%;height:10px;"></div>';

                        html += '<table border="1" cellpadding="0" cellspacing="0" class="table2">';
                        html += '<tr><td>保险责任</td><td>发票号</td><td>就诊日期</td><td>发票金额</td><td>费用分类</td><td>对应金额</td><td>赔付金额</td><td>其他扣减</td><td>免赔额</td><td>理算说明</td><td>备注</td></tr>';
                        var data = _results;
                        // 第二个table
                        // 按照条款对单证进行分类
                        for (var i = 0; i < data.length; i++) {
                            var clauseitems = [];
                            if (data[i].clauseitems) {
                                clauseitems = JSON.parse(data[i].clauseitems);
                            }
                            var reduction = JSON.parse(data[i].reduction);

                            otherReduction = JSON.parse(data[i].otherReduction);

                            for (var j = 0; j < clauseitems.length; j++) {
                                var formulatype = clauseitems[j].formulatype;
                                var clauseid = clauseitems[j].clauseid;
                                var clausename = clauseitems[j].clausename;
                                var count = clauseitems[j].count;
                                if (formulatype == 1 || formulatype == 2 || formulatype == 3 || formulatype == 6) {
                                    if (Clause_Pic_Items[clausename]) {
                                        var obj = {
                                            OCRContent: data[i].OCRContent,
                                            Reduction: reduction[clausename]
                                        }
                                        Clause_Pic_Items[clausename].push(obj);
                                    }
                                    else {
                                        var obj = {
                                            OCRContent: data[i].OCRContent,
                                            Reduction: reduction[clausename]
                                        }
                                        Clause_Pic_Items[clausename] = [];
                                        Clause_Pic_Items[clausename].push(obj);
                                    }
                                }
                            }
                        }

                        // 发票金额合计
                        var TotalAmount1 = 0;
                        // 个人支付（医保内）合计
                        var TotalAmount2 = 0;
                        // 基金支付合计
                        var TotalAmount3 = 0;
                        // 医保外全自费合计
                        var TotalAmount4 = 0;
                        // 部分资费金额合计
                        var TotalAmount5 = 0;
                        // 剔减金额合计
                        var TotalAmount6 = 0;

                        // 遍历Clause_Pic_Items生成table
                        for (var key in Clause_Pic_Items) {
                            var OCRContent = JSON.parse(Clause_Pic_Items[key][0].OCRContent);
                            // 发票类型
                            var templateNo = OCRContent.templateNo;
                            // ocr字段
                            var field_list = OCRContent.field_list;
                            // 发票号
                            var InvoiceNo = '';
                            // 就诊日期
                            var ArriveDate_LeaveDate = '';
                            // 发票金额
                            var TotalAmount = 0;
                            // 个人账户支付+自负
                            var PersonalPay_SelfResponse = 0;
                            // 统筹+附加
                            var MedicarePay_AdditionalPay = 0;
                            // 自费
                            var SelfExpense = 0;
                            // 分类自负
                            var ClassifySelf = 0;

                            // 循环匹配字段
                            for (var t = 0; t < field_list.length; t++) {
                                var text_category = field_list[t].text_category;
                                var text = field_list[t].text;
                                // 发票号
                                if (text_category == 'InvoiceNo') {
                                    InvoiceNo = text;
                                }
                                // 就诊日期
                                else if (text_category == 'ArriveDate') {
                                    if (ArriveDate_LeaveDate == '') {
                                        ArriveDate_LeaveDate = text;
                                    }
                                    else {
                                        ArriveDate_LeaveDate = text + ' —— ' + ArriveDate_LeaveDate;
                                    }
                                }
                                else if (text_category == 'LeaveDate') {
                                    if (ArriveDate_LeaveDate == '') {
                                        ArriveDate_LeaveDate = text;
                                    }
                                    else {
                                        ArriveDate_LeaveDate = ArriveDate_LeaveDate + ' —— ' + text;
                                    }
                                }
                                // 发票金额
                                else if (text_category == 'TotalAmount') {
                                    TotalAmount = text;
                                    TotalAmount1 += text * 1;
                                }
                                // 个人账户支付+自负
                                else if (text_category == 'PersonalPay') {
                                    PersonalPay_SelfResponse += text * 1;
                                    // PersonalPay_SelfResponse = PersonalPay_SelfResponse.toFixed(2);
                                    TotalAmount2 += text * 1;
                                }
                                else if (text_category == 'SelfResponse') {
                                    PersonalPay_SelfResponse += text * 1;
                                    // PersonalPay_SelfResponse = PersonalPay_SelfResponse.toFixed(2);
                                    TotalAmount2 += text * 1;
                                }
                                // 统筹+附加
                                else if (text_category == 'MedicarePay') {
                                    MedicarePay_AdditionalPay += text * 1;
                                    // MedicarePay_AdditionalPay = MedicarePay_AdditionalPay.toFixed(2);
                                    TotalAmount3 += text * 1;
                                }
                                else if (text_category == 'AdditionalPay') {
                                    MedicarePay_AdditionalPay += text * 1;
                                    // MedicarePay_AdditionalPay = MedicarePay_AdditionalPay.toFixed(2);
                                    TotalAmount3 += text * 1;
                                }
                                // 自费
                                else if (text_category == 'SelfExpense') {
                                    SelfExpense = text;
                                    TotalAmount4 += text * 1;
                                }
                                // 分类自负
                                else if (text_category == 'ClassifySelf') {
                                    ClassifySelf = text;
                                    TotalAmount5 += text * 1;
                                }
                            }
                            // console.log('paymoneyByName:', paymoneyByName);
                            html += '<tr>';
                            html += '<td rowspan="' + 5 * Clause_Pic_Items[key].length + '">' + key + '</td>';
                            html += '<td rowspan="5">' + InvoiceNo + '</td>';
                            html += '<td rowspan="5">' + ArriveDate_LeaveDate + '</td>';
                            html += '<td rowspan="5">￥' + TotalAmount || 0 + '</td>';
                            html += '<td>个人支付（医保内）</td>';
                            html += '<td>￥' + PersonalPay_SelfResponse || 0 + '</td>';

                            // 赔付金额处理
                            html += '<td rowspan="' + 5 * Clause_Pic_Items[key].length + '">￥' + paymoneyByName[key] || 0 + '</td>';

                            // 其他扣减处理
                            html += '<td rowspan="' + 5 * Clause_Pic_Items[key].length + '">￥' + otherReduction[key].reduc || 0 + '</td>';

                            // 免赔额处理
                            if (ClauseByName[key].abatetype == 1) {
                                html += '<td rowspan="' + 5 * Clause_Pic_Items[key].length + '">次免赔 ' + ClauseByName[key].abatecount + ' 元</td>';
                            }
                            else {
                                html += '<td rowspan="' + 5 * Clause_Pic_Items[key].length + '">年免赔 ' + ClauseByName[key].abatecount + ' 元</td>';
                            }

                            // 理算说明处理，条款计算公式 带金额套计算公式（同初审汇总页）
                            html += '<td rowspan="' + 5 * Clause_Pic_Items[key].length + '">' + otherReduction[key].formulaStr + '</td>';

                            // 备注处理
                            html += '<td rowspan="' + 5 * Clause_Pic_Items[key].length + '">' + otherReduction[key].reducRemark + '</td>';

                            html += '<tr><td>基金支付</td><td>￥' + MedicarePay_AdditionalPay || 0 + '</td></tr>';
                            html += '<tr><td>医保外全自费</td><td>￥' + SelfExpense || 0 + '</td></tr>';
                            html += '<tr><td>部分资费金额</td><td>￥' + ClassifySelf || 0 + '</td></tr>';
                            html += '<tr><td>剔减金额</td><td>￥' + Clause_Pic_Items[key][0].Reduction || 0 + '</td></tr>';

                            TotalAmount6 += Clause_Pic_Items[key][0].Reduction * 1;

                            // 如果不只一个单证
                            // 在这里做循环
                            if (Clause_Pic_Items[key].length >= 2) {
                                for (var i = 1; i < Clause_Pic_Items[key].length; i++) {
                                    var OCRContent = JSON.parse(Clause_Pic_Items[key][i].OCRContent);
                                    // 发票类型
                                    var templateNo = OCRContent.templateNo;
                                    // ocr字段
                                    var field_list = OCRContent.field_list;
                                    // 发票号
                                    var InvoiceNo = '';
                                    // 就诊日期
                                    var ArriveDate_LeaveDate = '';
                                    // 发票金额
                                    var TotalAmount = 0;
                                    // 个人账户支付+自负
                                    var PersonalPay_SelfResponse = 0;
                                    // 统筹+附加
                                    var MedicarePay_AdditionalPay = 0;
                                    // 自费
                                    var SelfExpense = 0;
                                    // 分类自负
                                    var ClassifySelf = 0;

                                    // 循环匹配字段
                                    for (var t = 0; t < field_list.length; t++) {
                                        var text_category = field_list[t].text_category;
                                        var text = field_list[t].text;
                                        // 发票号
                                        if (text_category == 'InvoiceNo') {
                                            InvoiceNo = text;
                                        }
                                        // 就诊日期
                                        else if (text_category == 'ArriveDate') {
                                            if (ArriveDate_LeaveDate == '') {
                                                ArriveDate_LeaveDate = text;
                                            }
                                            else {
                                                ArriveDate_LeaveDate = text + ' —— ' + ArriveDate_LeaveDate;
                                            }
                                        }
                                        else if (text_category == 'LeaveDate') {
                                            if (ArriveDate_LeaveDate == '') {
                                                ArriveDate_LeaveDate = text;
                                            }
                                            else {
                                                ArriveDate_LeaveDate = ArriveDate_LeaveDate + ' —— ' + text;
                                            }
                                        }
                                        // 发票金额
                                        else if (text_category == 'TotalAmount') {
                                            TotalAmount = text;
                                            TotalAmount1 += text * 1;
                                        }
                                        // 个人账户支付+自负
                                        else if (text_category == 'PersonalPay') {
                                            PersonalPay_SelfResponse += text * 1;
                                            // PersonalPay_SelfResponse = PersonalPay_SelfResponse.toFixed(2);
                                            TotalAmount2 += text * 1;
                                        }
                                        else if (text_category == 'SelfResponse') {
                                            PersonalPay_SelfResponse += text * 1;
                                            // PersonalPay_SelfResponse = PersonalPay_SelfResponse.toFixed(2);
                                            TotalAmount2 += text * 1;
                                        }
                                        // 统筹+附加
                                        else if (text_category == 'MedicarePay') {
                                            MedicarePay_AdditionalPay += text * 1;
                                            // MedicarePay_AdditionalPay = MedicarePay_AdditionalPay.toFixed(2);
                                            TotalAmount3 += text * 1;
                                        }
                                        else if (text_category == 'AdditionalPay') {
                                            MedicarePay_AdditionalPay += text * 1;
                                            // MedicarePay_AdditionalPay = MedicarePay_AdditionalPay.toFixed(2);
                                            TotalAmount3 += text * 1;
                                        }
                                        // 自费
                                        else if (text_category == 'SelfExpense') {
                                            SelfExpense = text;
                                            TotalAmount4 += text * 1;
                                        }
                                        // 分类自负
                                        else if (text_category == 'ClassifySelf') {
                                            ClassifySelf = text;
                                            TotalAmount5 += text * 1;
                                        }
                                    }

                                    html += '<tr>';
                                    html += '<td rowspan="5">' + InvoiceNo + '</td>';
                                    html += '<td rowspan="5">' + ArriveDate_LeaveDate + '</td>';
                                    html += '<td rowspan="5">￥' + TotalAmount || 0 + '</td>';
                                    html += '<td>个人支付（医保内）</td>';
                                    html += '<td>￥' + PersonalPay_SelfResponse || 0 + '</td>';
                                    html += '<tr><td>基金支付</td><td>￥' + MedicarePay_AdditionalPay || 0 + '</td></tr>';
                                    html += '<tr><td>医保外全自费</td><td>￥' + SelfExpense || 0 + '</td></tr>';
                                    html += '<tr><td>部分资费金额</td><td>￥' + ClassifySelf || 0 + '</td></tr>';
                                    html += '<tr><td>剔减金额</td><td>￥' + Clause_Pic_Items[key][i].Reduction || 0 + '</td></tr>';

                                    TotalAmount6 += Clause_Pic_Items[key][i].Reduction * 1;
                                }
                            }
                        }

                        // 合计
                        html += '<tr><td rowspan="5" colspan="3">合计</td>';
                        html += '<td rowspan="5">￥' + TotalAmount1.toFixed(2) || 0 + '</td>';
                        html += '<td>个人支付（医保内）合计</td>';
                        html += '<td>￥' + TotalAmount2.toFixed(2) || 0 + '</td>';
                        html += '<td rowspan="5" colspan="5">各项费用分类，见下方释义说明</td></tr>';

                        html += '<tr><td>基金支付合计</td><td>￥' + TotalAmount3.toFixed(2) || 0 + '</td></tr>';
                        html += '<tr><td>医保外全自费合计</td><td>￥' + TotalAmount4.toFixed(2) || 0 + '</td></tr>';
                        html += '<tr><td>部分资费金额合计</td><td>￥' + TotalAmount5.toFixed(2) || 0 + '</td></tr>';
                        html += '<tr><td>剔减金额合计</td><td>￥' + TotalAmount6.toFixed(2) || 0 + '</td></tr>';

                        html += '</table>';
                        ep.emit('ep_getIgnoredInvoice');
                    }
                });
            });

            // 注销时的发票（全部）
            ep.once('ep_getAllInvoice', function () {
                var sqlCmd = 'select * from claimfile where cid=? and filetype in (?) and picstate in (0,1) and uploadstatus = 1;'
                var sqlParams = [claimid, ["SH_MED_MZFP", "SH_MED_ZYFP"]];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        var data = _results;
                        html += '<div style="width:100%;height:30px;"></div>';
                        html += '<p>您本次提交的发票清单如下：</p>';
                        html += '<table border="1" cellpadding="0" cellspacing="0" class="table3">';
                        html += '<tr><td>发票号</td><td>就诊日期</td><td>备注</td></tr>'

                        for (var i = 0; i < data.length; i++) {
                            // 备注
                            var filelog = data[i].filelog;
                            var filelogArr = [];
                            if (filelog) {
                                filelogArr = JSON.parse(filelog);
                            }
                            var filelogStr = '';
                            if (filelogArr.length > 0) {
                                filelogStr = filelogArr[filelogArr.length - 1].remark;
                            }
                            // 就诊日期
                            var field_list = JSON.parse(data[i].OCRContent).field_list;
                            var dateStr = '';
                            for (var j = 0; j < field_list.length; j++) {
                                if (field_list[j].text_category == 'ArriveDate') {
                                    dateStr = field_list[j].text;
                                }
                            }
                            for (var k = 0; k < field_list.length; k++) {
                                if (field_list[k].text_category == 'LeaveDate') {
                                    dateStr += ' —— ' + field_list[k].text;
                                }
                            }

                            html += '<tr>';
                            html += '<td>' + data[i].invoiceno + '</td>';
                            html += '<td>' + dateStr + '</td>';
                            html += '<td>' + filelogStr + '</td>';
                            html += '</tr>';
                        }

                        html += '</table>';

                        ep.emit('ep_createfile');
                    }
                });
            });

            // 非注销时的发票（忽略的）
            ep.once('ep_getIgnoredInvoice', function () {
                var sqlCmd = 'select * from claimfile where cid=? and filetype in (?) and picstate in (0,1) and uploadstatus = 1 and status = "忽略";'
                var sqlParams = [claimid, ["SH_MED_MZFP", "SH_MED_ZYFP"]];
                Me.db.query(sqlCmd, sqlParams, function (_err, _results) {
                    if (_err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        var data = _results;
                        html += '<div style="width:100%;height:30px;"></div>';
                        html += '<p>另外您所提交的发票中还有部分没有进行赔付，详见下表：</p>';
                        html += '<table border="1" cellpadding="0" cellspacing="0" class="table3">';
                        html += '<tr><td>发票号</td><td>就诊日期</td><td>备注</td></tr>'

                        for (var i = 0; i < data.length; i++) {
                            // 备注
                            var filelog = data[i].filelog;
                            var filelogArr = [];
                            if (filelog) {
                                filelogArr = JSON.parse(filelog);
                            }
                            var filelogStr = '';
                            if (filelogArr.length > 0) {
                                filelogStr = filelogArr[filelogArr.length - 1].remark;
                            }
                            // 就诊日期
                            var field_list = JSON.parse(data[i].OCRContent).field_list;
                            var dateStr = '';
                            for (var j = 0; j < field_list.length; j++) {
                                if (field_list[j].text_category == 'ArriveDate') {
                                    dateStr = field_list[j].text;
                                }
                            }
                            for (var k = 0; k < field_list.length; k++) {
                                if (field_list[k].text_category == 'LeaveDate') {
                                    dateStr += ' —— ' + field_list[k].text;
                                }
                            }

                            html += '<tr>';
                            html += '<td>' + data[i].invoiceno + '</td>';
                            html += '<td>' + dateStr + '</td>';
                            html += '<td>' + filelogStr + '</td>';
                            html += '</tr>';
                        }

                        html += '</table>';

                        ep.emit('ep_createfile');
                    }
                });
            });

            ep.once('ep_createfile', function () {
                // 注销27，pdf模板2
                if (claimStatus == 27) {
                    html += '<p style="margin:10px 0;">抱歉的通知您，以上发票，未能在我司获得赔偿。原因请见备注信息。</p>';
                    html += '<p style="margin:10px 0;">如果您对理赔结果有疑问请在收到本通知后30日内与本公司联系。</p>';
                    html += '<p style="margin:10px 0;text-align:right;">中国人民财产保险股份有限公司上海分公司</p>';
                }
                else {
                    html += '<p style="margin:10px 0;">说明，“基金支付”指在发票的合计金额内，但由基本医疗保险基金、地方附加基金等支付无需本人支付的部分。“医保外全自费”指不属于社保支付范围内的自费药品和诊疗项目费用。“部分自费金额”指不属于社保支付范围内的乙类药品和诊疗项目先行自费部分费用。“其他扣减”指经我司审核不属于保险责任的费用。如果您已从其他途径获得医疗费用补偿，我们仅就差额部分根据保单约定进行理算。</p>';
                    html += '<p style="margin:10px 0;">免赔额是您保单约定的保险人不负责赔偿的损失金额，赔付比例是您合乎保单赔偿条件的损失金额赔付比例。理赔金额=【保单约定赔偿范围内损失金额-免赔额】*赔付比例。</p>';
                    html += '<p style="margin:10px 0;"><b>如果您的累计赔付金额已经超过保单约定的赔付限额，则超过部分将无法在本保单项下获得赔偿。</b></p>';
                    html += '<p style="margin:10px 0;">本通知书是我们对您此次理赔申请的处理结果的详细说明，不作为领款凭证，如有赔付则保险金款项将于本清单打印后二到是个工作日内以银行转账或其他形式发放。</p>';
                    html += '<p style="margin:10px 0;">如果您对理赔结果有疑问请在收到本通知后30日内与本公司联系。</p>';
                    html += '<p style="margin:10px 0;text-align:right;">中国人民财产保险股份有限公司上海分公司</p>';
                }

                html += '</body>';
                html += '</html>';
                fs.writeFile('./web/upload/html/' + taskno + '.html', html, function (err) {
                    if (err) {
                        return cbError('50003', Me.cb);
                    }
                    else {
                        // var htmlurl = settings.HtmlUrl + taskno + '.html';
                        // console.log('htmlurl:', htmlurl);
                        // return Me.cb(200, "", '');
                        // html转pdf
                        phantom.create().then(function (ph) {
                            ph.createPage().then(function (page) {
                                var htmlurl = settings.HtmlUrl + taskno + '.html';
                                console.log('htmlurl:', htmlurl);
                                page.open('./web/upload/html/' + taskno + '.html').then(function (status) {
                                    console.log("status:", status);
                                    if (status === "fail") {
                                        return Me.cb(300, "下载失败", '');
                                    }
                                    else {
                                        var pdfurl = settings.PdfUrl + taskno + '.pdf';
                                        console.log('pdfurl:', pdfurl);
                                        page.property('viewportSize', { width: 1080 });
                                        page.render('./web/upload/pdf/' + taskno + '.pdf').then(function () {
                                            console.log('Page rendered');
                                            ph.exit();
                                            return Me.cb(200, "", pdfurl);
                                        });
                                    }
                                });
                            });
                        }
                        )

                    }
                })
            });

        }
    };
};
function cbError(code, cb) {
    cb(code, _errors[code].message, _errors[code].name);
}

// 补零函数
function PrefixInteger(num, n) {
    return (Array(n).join(0) + num).slice(-n);
}

// 根据银行卡号查询银行标准名称，并回写到claim
function GetBankName(bankcard, claimid) {
    var ep = new EventProxy();
    var db = require('../libs/mysql.js');
    var bankname;
    // 根据银行卡号查询银行名称
    var url = 'https://ccdcapi.alipay.com/validateAndCacheCardInfo.json';
    var formData = {
        _input_charset: 'utf-8',
        cardNo: bankcard,
        cardBinCheck: true
    }
    request.post(url, { form: formData }, function (err, response, body) {
        if (body == 'undefined' || body == undefined) {

        }
        try {
            bankname = JSON.parse(body).bank;
        }
        catch (err) {
            console.log('err: 请求银行卡接口异常');
            return false;
        }
        bankname = CodeToName(bankname);
        ep.emit('ep_update_claim');
    });
    // 将银行名称写入理赔表claim
    ep.once('ep_update_claim', function () {
        var sqlCmd = 'update claim set bankname=? where id=?;';
        var sqlParams = [bankname, claimid];
        db.query(sqlCmd, sqlParams, function (_err, _results) {
            if (_err) {

            }
            else {

            }
        });
    });
}

// 根据银行卡号查询银行标准名称，并回写到claim
function GetBankName(bankcard, claimid) {
    var ep = new EventProxy();
    var db = require('../libs/mysql.js');
    var bankname;
    // 根据银行卡号查询银行名称
    var url = 'https://ccdcapi.alipay.com/validateAndCacheCardInfo.json';
    var formData = {
        _input_charset: 'utf-8',
        cardNo: bankcard,
        cardBinCheck: true
    }
    request.post(url, { form: formData }, function (err, response, body) {
        if (body == 'undefined' || body == undefined) {

        }
        try {
            bankname = JSON.parse(body).bank;
        }
        catch (err) {
            console.log('err: 请求银行卡接口异常');
            return false;
        }
        bankname = CodeToName(bankname);
        ep.emit('ep_update_claim');
    });
    // 将银行名称写入理赔表claim
    ep.once('ep_update_claim', function () {
        var sqlCmd = 'update claim set bankname=? where id=?;';
        var sqlParams = [bankname, claimid];
        db.query(sqlCmd, sqlParams, function (_err, _results) {
            if (_err) {

            }
            else {

            }
        });
    });
}

// 银行英文转中文
function CodeToName(code) {
    var bankObj = {
        "SRCB": "深圳农村商业银行",
        "BGB": "广西北部湾银行",
        "SHRCB": "上海农村商业银行",
        "BJBANK": "北京银行",
        "WHCCB": "威海市商业银行",
        "BOZK": "周口银行",
        "KORLABANK": "库尔勒市商业银行",
        "SPABANK": "平安银行",
        "SDEB": "顺德农商银行",
        "HURCB": "湖北省农村信用社",
        "WRCB": "无锡农村商业银行",
        "BOCY": "朝阳银行",
        "CZBANK": "浙商银行",
        "HDBANK": "邯郸银行",
        "BOC": "中国银行",
        "BOD": "东莞银行",
        "CCB": "中国建设银行",
        "ZYCBANK": "遵义市商业银行",
        "SXCB": "绍兴银行",
        "GZRCU": "贵州省农村信用社",
        "ZJKCCB": "张家口市商业银行",
        "BOJZ": "锦州银行",
        "BOP": "平顶山银行",
        "HKB": "汉口银行",
        "SPDB": "上海浦东发展银行",
        "NXRCU": "宁夏黄河农村商业银行",
        "NYNB": "广东南粤银行",
        "GRCB": "广州农商银行",
        "BOSZ": "苏州银行",
        "HZCB": "杭州银行",
        "HSBK": "衡水银行",
        "HBC": "湖北银行",
        "JXBANK": "嘉兴银行",
        "HRXJB": "华融湘江银行",
        "BODD": "丹东银行",
        "AYCB": "安阳银行",
        "EGBANK": "恒丰银行",
        "CDB": "国家开发银行",
        "TCRCB": "江苏太仓农村商业银行",
        "NJCB": "南京银行",
        "ZZBANK": "郑州银行",
        "DYCB": "德阳商业银行",
        "YBCCB": "宜宾市商业银行",
        "SCRCU": "四川省农村信用",
        "KLB": "昆仑银行",
        "LSBANK": "莱商银行",
        "YDRCB": "尧都农商行",
        "CCQTGB": "重庆三峡银行",
        "FDB": "富滇银行",
        "JSRCU": "江苏省农村信用联合社",
        "JNBANK": "济宁银行",
        "CMB": "招商银行",
        "JINCHB": "晋城银行JCBANK",
        "FXCB": "阜新银行",
        "WHRCB": "武汉农村商业银行",
        "HBYCBANK": "湖北银行宜昌分行",
        "TZCB": "台州银行",
        "TACCB": "泰安市商业银行",
        "XCYH": "许昌银行",
        "CEB": "中国光大银行",
        "NXBANK": "宁夏银行",
        "HSBANK": "徽商银行",
        "JJBANK": "九江银行",
        "NHQS": "农信银清算中心",
        "MTBANK": "浙江民泰商业银行",
        "LANGFB": "廊坊银行",
        "ASCB": "鞍山银行",
        "KSRB": "昆山农村商业银行",
        "YXCCB": "玉溪市商业银行",
        "DLB": "大连银行",
        "DRCBCL": "东莞农村商业银行",
        "GCB": "广州银行",
        "NBBANK": "宁波银行",
        "BOYK": "营口银行",
        "SXRCCU": "陕西信合",
        "GLBANK": "桂林银行",
        "BOQH": "青海银行",
        "CDRCB": "成都农商银行",
        "QDCCB": "青岛银行",
        "HKBEA": "东亚银行",
        "HBHSBANK": "湖北银行黄石分行",
        "WZCB": "温州银行",
        "TRCB": "天津农商银行",
        "QLBANK": "齐鲁银行",
        "GDRCC": "广东省农村信用社联合社",
        "ZJTLCB": "浙江泰隆商业银行",
        "GZB": "赣州银行",
        "GYCB": "贵阳市商业银行",
        "CQBANK": "重庆银行",
        "DAQINGB": "龙江银行",
        "CGNB": "南充市商业银行",
        "SCCB": "三门峡银行",
        "CSRCB": "常熟农村商业银行",
        "SHBANK": "上海银行",
        "JLBANK": "吉林银行",
        "CZRCB": "常州农村信用联社",
        "BANKWF": "潍坊银行",
        "ZRCBANK": "张家港农村商业银行",
        "FJHXBC": "福建海峡银行",
        "ZJNX": "浙江省农村信用社联合社",
        "LZYH": "兰州银行",
        "JSB": "晋商银行",
        "BOHAIB": "渤海银行",
        "CZCB": "浙江稠州商业银行",
        "YQCCB": "阳泉银行",
        "SJBANK": "盛京银行",
        "XABANK": "西安银行",
        "BSB": "包商银行",
        "JSBANK": "江苏银行",
        "FSCB": "抚顺银行",
        "HNRCU": "河南省农村信用",
        "COMM": "交通银行",
        "XTB": "邢台银行",
        "CITIC": "中信银行",
        "HXBANK": "华夏银行",
        "HNRCC": "湖南省农村信用社",
        "DYCCB": "东营市商业银行",
        "ORBANK": "鄂尔多斯银行",
        "BJRCB": "北京农村商业银行",
        "XYBANK": "信阳银行",
        "ZGCCB": "自贡市商业银行",
        "CDCB": "成都银行",
        "HANABANK": "韩亚银行",
        "CMBC": "中国民生银行",
        "LYBANK": "洛阳银行",
        "GDB": "广东发展银行",
        "ZBCB": "齐商银行",
        "CBKF": "开封市商业银行",
        "H3CB": "内蒙古银行",
        "CIB": "兴业银行",
        "CRCBANK": "重庆农村商业银行",
        "SZSBK": "石嘴山银行",
        "DZBANK": "德州银行",
        "SRBANK": "上饶银行",
        "LSCCB": "乐山市商业银行",
        "JXRCU": "江西省农村信用",
        "ICBC": "中国工商银行",
        "JZBANK": "晋中市商业银行",
        "HZCCB": "湖州市商业银行",
        "NHB": "南海农村信用联社",
        "XXBANK": "新乡银行",
        "JRCB": "江苏江阴农村商业银行",
        "YNRCC": "云南省农村信用社",
        "ABC": "中国农业银行",
        "GXRCU": "广西省农村信用",
        "PSBC": "中国邮政储蓄银行",
        "BZMD": "驻马店银行",
        "ARCU": "安徽省农村信用社",
        "GSRCU": "甘肃省农村信用",
        "LYCB": "辽阳市商业银行",
        "JLRCU": "吉林农信",
        "URMQCCB": "乌鲁木齐市商业银行",
        "XLBANK": "中山小榄村镇银行",
        "CSCB": "长沙银行",
        "JHBANK": "金华银行",
        "BHB": "河北银行",
        "NBYZ": "鄞州银行",
        "LSBC": "临商银行",
        "BOCD": "承德银行",
        "SDRCU": "山东农信",
        "NCB": "南昌银行",
        "TCCB": "天津银行",
        "WJRCB": "吴江农商银行",
        "CBBQS": "城市商业银行资金清算中心",
        "HBRCU": "河北省农村信用社"
    }
    var name = bankObj[code];
    return name;
}

// 恢复之前预扣的理赔额度，和共享理赔额度
// withholding：[{"id":88,"deduction":"2587"},{"id":89,"deduction":"10301"}]
// shareclause：{"88,89":"13467.00"}
// 返回执行的sql语句
function RecoveryMoney(withholding, shareclause, userpolicy_id) {
    var withholding = withholding;
    var shareclause = shareclause;
    var userpolicy_id = userpolicy_id;
    var sqlCmd = '';
    var sqlParams = [];
    if (withholding) {
        withholding = JSON.parse(withholding);
        for (var i = 0; i < withholding.length; i++) {
            sqlCmd += 'update policy_clause_amount set amount = amount+?,abate_amount = abate_amount+? where userpolicy_id=? and clause_id=? and count!=0;';
            sqlParams.push(withholding[i].deduction * 1, withholding[i].abate * 1, userpolicy_id, withholding[i].id);
        }
    }
    if (shareclause) {
        shareclause = JSON.parse(shareclause);
        for (var k in shareclause) {
            var arr = k.split(',');
            sqlCmd += 'update policy_clause_amount set share_amount = share_amount+? where userpolicy_id=? and clause_id in (?);';
            sqlParams.push(shareclause[k] * 1, userpolicy_id, arr);
        }
    }
    return [sqlCmd, sqlParams];
}


// 日期转化20170117->2017-01-17
function transDate(str) {
    if (!/^\d{8}$/.test(str)) {
        return str;
    }
    else {
        var arr = str.split('');
        var _str = arr[0] + arr[1] + arr[2] + arr[3] + '/' + arr[4] + arr[5] + '/' + arr[6] + arr[7];
        return _str;
    }
}

// 通过家属查询员工以及家属的全部信息
function GetStaff(policyno, belong) {
    var ep = new EventProxy();
    var db = require('../libs/mysql.js');
    var result = [];
    var passno = '';

    var sqlCmd = 'select userpolicy.*,publicuser.mobile,baseclause.name from userpolicy left join publicuser on userpolicy.uid = publicuser.id left join clause on userpolicy.pid = clause.pid and userpolicy.schemeid = clause.sid left join baseclause on clause.cid = baseclause.id where clause.status=1 and baseclause.status=1 and userpolicy.policyno = ? and userpolicy.passno = ?;';
    var sqlParams = [policyno, belong];
    db.query(sqlCmd, sqlParams, function (_err, _results) {
        if (_err) {
            return cbError('50003', Me.cb);
        }
        else {
            // 将返回的数据做处理
            for (var i = 0; i < _results.length; i++) {
                if (result.length == 0) {
                    result.push(_results[i]);
                    result[result.length - 1]['clause'] = [];
                    result[result.length - 1]['clause'].push(_results[i].name);
                }
                else {
                    if (result[result.length - 1].policyno == _results[i].policyno) {
                        result[result.length - 1]['clause'].push(_results[i].name);
                    }
                    else {
                        result.push(_results[i]);
                        result[result.length - 1]['clause'] = [];
                        result[result.length - 1]['clause'].push(_results[i].name);
                    }
                }
            }
            // return Me.cb(200, "", result);
            ep.emit('qp_query_knownfamily');
        }
    });

    ep.once('qp_query_knownfamily', function () {
        var sqlCmd = 'select userpolicy.*,publicuser.mobile from userpolicy left join publicuser on userpolicy.passno = publicuser.passno and userpolicy.passtype = publicuser.passtype and userpolicy.realname = publicuser.realname where userpolicy.character=2 and userpolicy.status=1 and userpolicy.belong=?;';
        var sqlParams = [belong];
        db.query(sqlCmd, sqlParams, function (_err, _results) {
            if (_err) {
                return cbError('50003', Me.cb);
            }
            else {
                for (var i = 0; i < result.length; i++) {
                    for (var j = 0; j < _results.length; j++) {
                        if (result[i].policyno == _results[j].policyno) {
                            var obj = {
                                passtype: _results[j].passtype,
                                passno: _results[j].passno,
                                realname: _results[j].realname,
                                mobile: _results[j].mobile
                            }
                            if (result[i]['knownfamily']) {
                                result[i]['knownfamily'].push(obj);
                            }
                            else {
                                result[i]['knownfamily'] = [];
                                result[i]['knownfamily'].push(obj);
                            }
                        }
                    }
                }
                console.log('result:', result);
                return result[0];
            }
        })
    })
}