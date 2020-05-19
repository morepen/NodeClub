var fs = require('fs');
var errors = require("../libs/errors");

function createExcelUrl(filename, excel, excelDir, callback) {
    var Me;
    Me = this;
    Me.excelObj = {};
    Me.excelObj.filename = filename + '.xlsx';//文件名
    Me.excelObj.values = excel;
//    console.log("生成Excel导出数据：", Me.excelObj.excelDir);
    Me.excelObj.excelDir = excelDir;
    var xlsx = require('node-xlsx');
    Me.excelObj.fs = require('fs');
    Me.excelObj.fullpath =  Me.excelObj.excelDir;
    Me.excelObj.filebuffer = xlsx.build([{name: "Sheet1", data: Me.excelObj.values}]); // returns a buffer
    if (!Me.excelObj.fs.existsSync(Me.excelObj.fullpath)) {
        Me.excelObj.fs.mkdir(Me.excelObj.fullpath, 0777, function (err) {
            if (err) {
                //Me.callbackFunction(err, null);
                return callback(err, null);
            } else {
                Me.excelObj.fs.writeFile(Me.excelObj.fullpath + "\\" + Me.excelObj.filename, Me.excelObj.filebuffer, 'binary', function (_err, _result) {
                    if (_err) {
                        //Me.callbackFunction(_err, _result);
                        //return callback(_err, _result);
                        return callback(_err, null);
                    }
                    else {
                        //Me.callbackFunction(_err, Me.excelObj.excelDir + "\\" + Me.excelObj.filename)
                        //return callback(_err, Me.excelObj.excelDir + "\\" + Me.excelObj.filename);
                        return callback(null, Me.excelObj.excelDir + "\\" + Me.excelObj.filename);
                    }
                });
            }
        });
    } else {
        Me.excelObj.fs.writeFile(Me.excelObj.fullpath + "\\" + Me.excelObj.filename, Me.excelObj.filebuffer, 'binary', function (_err, _result) {
            if (_err) {
                //Me.callbackFunction(_err, _result);
                //return callback(_err, _result);
                return callback(_err, null);
            } else {
                //Me.callbackFunction(_err, Me.excelObj.excelDir + "\\" + Me.excelObj.filename)
                return callback(null,  "excel\\"+ Me.excelObj.filename);
            }
        });
    }
}
exports.createExcelUrl = createExcelUrl;

/*
 生成excel文件在30分钟内未被下载即从服务端删除
 setTimeout当服务器在30分钟内中止服务再恢复后要重新记录时间
 @filename excel文件名
 @callback 回调结果
 */
function deleteFile(fullPath, callback) {
    //console.log("传递的路径为：", fullPath);
    return setTimeout((function () {
        return fs.exists(fullPath, function (exists) {
            if (exists) {
                return fs.unlink(fullPath, function (err) {
                    if (err) {
                        return callback(err, null);
                    } else {
                        return callback(null, false);
                    }
                });
            } else {
                return callback(errors.NoFileExist);
            }
        });
    }), 30 * 60 * 1000);
}
exports.deleteFile = deleteFile;