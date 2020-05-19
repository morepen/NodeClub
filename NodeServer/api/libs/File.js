
var errors = require("./errors");
var fs = require("fs");
var os = require("os");
var mkdirp = require("mkdirp");

var hcUti = require('./hcUti');

var _ = require('underscore');

/**
*  @module File
*  @description 服务端基础文件类，封装对基本文件操作方法,封装node.js中的原生fs模块,大部分为异步调用方法
*  @example file = new File()
*  file.isFileExist() 判断文件是否存在
*/
var File = (function () {
    function File(opts) {
        this.opts = opts;
        this._TIMEINTERVAL = 30 * 60 * 1000;
        this.defaultOpts = {
            fileDirs: []
        };
        this._opts = {};
        this._fullPath = '';
        this._errMsg = '';
        this._errMsg = "none";
        this._opts = opts ? opts : this.defaultOpts;
    }
    Object.defineProperty(File.prototype, "fullPath", {
        /**
        *  setter/getter 存取器方法
        */
        get: function () {
            return this._fullPath;
        },
        set: function (path) {
            this._fullPath = path;
        },
        enumerable: true,
        configurable: true
    });


    /**
    * joinfilePath 传递文件数组拼接文件路径
    */
    File.joinfilePath = function (arr) {
        var path, tmp_arr;
        tmp_arr = arr;
        if (os.type() === "Windows_NT") {
            path = tmp_arr.join("\\");
        } else {
            path = tmp_arr.join("/");
        }
        return path;
    };

    /**
    * splitfilePath 分割文件名为不同字符串
    */
    File.splitfilePath = function (str) {
        var arr, tmp_str;
        tmp_str = str;
        if (os.type() === "Windows_NT") {
            arr = tmp_str.split("\\");
        } else {
            arr = tmp_str.split("/");
        }
        return arr;
    };

    File.joindownloadUrl = function (arr) {
        var path, tmp_arr;
        tmp_arr = arr;
        path = tmp_arr.join("/");
        return path;
    };

    // isValidFileName 检查文件名是否合法
    // @param [String] filename 待验证的文件名
    // @return [boolean] 文件名是否通过正则表达式进行匹配
    File.prototype.isValidFileName = function (filename) {
        var str;
        if (filename.length < 0 || filename.length > 255) {
            return false;
        } else {
            str = filename.match(/^[^\\\/:\*\?\|"<>]+$/);
            if (str === null) {
                return false;
            } else {
                return true;
            }
        }
    };

    // isFileExist 检查传入文件名的文件是否存在
    // @param  [String] filename 检验是否存在的文件名
    // @return [Function] callback(err,result) result为booeaan 文件是否存在
    File.prototype.isFileExist = function (filename, callback) {
        return fs.exists(filename, function (exists) {
            if (exists) {
                return callback(null, exists);
            } else {
                return callback(errors.NoFileExist);
            }
        });
    };

    // _walkByDFS 采用深度优先策略遍历文件夹中所有文件
    // @param [String] dir 文件目录
    // @option option [String] type 获取文件列表类型 传递absolute获取完整路径 传递part仅获取文件名。默认absolute
    // @return [Function] callback(err,result) result为文件列表
    // @private
    File.prototype._walkByDFS = function (dir, type, callback) {
        var _this = this;
        return fs.readdir(dir, function (err, files) {
            var dirList, fileList;
            if (err) {
                return callback(err, null);
            } else {
                dirList = files;
                fileList = [];
                if (dirList.length === 0) {
                    return callback(null, fileList);
                } else {
                    return dirList.forEach(function (item) {
                        var filepath, stats;
                        filepath = File.joinfilePath([dir, item]);
                        stats = fs.statSync(filepath);
                        if (stats.isDirectory()) {
                            return _this._walkByDFS(filepath, type, callback);
                        } else {
                            if (type === "absolute") {
                                fileList.push(filepath);
                            } else if (type === "part") {
                                fileList.push(item);
                            }
                            if (item === _.last(dirList)) {
                                return callback(null, fileList);
                            }
                        }
                    });
                }
            }
        });
    };

    // 获取指定目录下所有文件列表
    // @param [String] dir 文件根目录
    // @option option [String] type 获取文件列表类型 传递absolute获取完整路径 传递part仅获取文件名。默认absolute
    // @return [Function] callback 回调结果 (err,result) 错误与文件列表数组
    File.prototype.getFileList = function (dir, type, callback) {
        var _this = this;
        type = type || "absolute";
        return fs.exists(dir, function (exists) {
            if (exists) {
                return _this._walkByDFS(dir, type, function (err, result) {
                    if (err) {
                        return callback(err, null);
                    } else {
                        return callback(null, result);
                    }
                });
            } else {
                return callback(errors.NoFileExist);
            }
        });
    };

    // loadFile 读取文件内容接口
    // @param [String] filePath 文件全路径
    // @param [String] char_set 字符编码集合，传入''默认为buffer
    // @return [Function] callback 回调结果 (err,result) 错误与文件列表数组
    File.prototype.loadFile = function (filePath, char_set, callback) {
        return fs.exists(filePath, function (exists) {
            if (exists) {
                return fs.readFile(filePath, char_set, function (error, data) {
                    if (error) {
                        return callback(error, null);
                    } else {
                        return callback(null, data);
                    }
                });
            } else {
                return callback(errors.NoFileExist);
            }
        });
    };

    // createFile 创建文件
    // @param [String] content 文件内容
    // @param [String] dir 文件目录
    // @param [String] fullPath 传递完整的文件路径
    // @return [Function] callback 回调返回结果
    // 实现方式:传入文件目录依照\或/分隔符分割成不同的路径数组，递归检查目录是否存在，没有目录时创建目录，有目录时继续检查下一级目录。
    File.prototype.createFile = function (content, dir, fullPath, callback) {
        return fs.exists(dir, function (exists) {
            if (exists) {
                return fs.writeFile(fullPath, content, "utf-8", function (err) {
                    if (err) {
                        return callback(err, null);
                    } else {
                        return callback(null, true);
                    }
                });
            } else {
                console.log("fullPath:" + fullPath + "dir:" + dir);
                return mkdirp(dir, function (err) {
                    if (err) {
                        return callback(err, null);
                    } else {
                        return fs.writeFile(fullPath, content, "utf-8", function (err) {
                            if (err) {
                                return callback(err, false);
                            } else {
                                return callback(null, true);
                            }
                        });
                    }
                });
            }
        });
    };

    // deleteFile 生成文件在指定时间间隔内未被下载即从服务端删除 setTimeout当服务器在30分钟内中止服务再恢复后要重新记录时间
    // @param [Number] timeInterval default:30min 时间间隔
    // @param [String] filename 待删除文件名
    // @return [Function] callback 回调结果(err,result) result为boolean值
    File.prototype.deleteFile = function (fullPath, timeInterval, callback) {
        var interval;
        interval = timeInterval === null ? this._TIMEINTERVAL : timeInterval;
        return setTimeout((function () {
            return fs.exists(fullPath, function (exists) {
                if (exists) {
                    return fs.unlink(fullPath, function (err) {
                        if (err) {
                            return callback(err, null);
                        } else {
                            return callback(null, true);
                        }
                    });
                } else {
                    return callback(errors.NoFileExist);
                }
            });
        }), interval);
    };

    File.prototype.getAllFiles = function (root) {
        var _this = this;
        var res = [];
        var files = fs.readdirSync(root);
        files.forEach(function (file) {
            var pathname = root + '/' + file;
            var stat = fs.lstatSync(pathname);
            if (!stat.isDirectory()) {
                res.push(pathname);
            } else {
                res = res.concat(_this.getAllFiles(pathname));
            }
        });
        return res;
    };

    File.prototype.delFiles = function (callback) {
        var _this = this;
        var dirs = this._opts;
        var deletedFiles = [];
        for (var i = 0; i < dirs.length; i++) {
            var list = this.getAllFiles(dirs[i].fileDir);
            list.forEach(function (item) {
                var stat = fs.statSync(item);
                if ((Date.now() - stat.ctime.getTime()) > dirs[i].liveCycle) {
                    deletedFiles.push(item);
                }
            });
        }
        if (deletedFiles.length > 0) {
            hcUti.groupQueue(5, deletedFiles, function (path, callback) {
                _this.deleteFile(path, 0, callback);
            }, function (doneCb) {
                console.log('all done');
                callback(null, true);
            });
        } else {
            callback(null, true);
        }
    };
    return File;
})();

module.exports = File;
//# sourceMappingURL=File.js.map
