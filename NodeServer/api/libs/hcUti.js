
"use strict";
var EventProxy = require('eventproxy');
var util = require('util');
function formatDate(date, fmt) {
    var o = {
        "M+": date.getMonth() + 1,
        "d+": date.getDate(),
        "h+": date.getHours(),
        "m+": date.getMinutes(),
        "s+": date.getSeconds(),
        "q+": Math.floor((date.getMonth() + 3) / 3),
        "S": date.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt))
        fmt = fmt.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt))
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}
exports.formatDate = formatDate;

function TimeCount(time1, time2) {
    var str = "";

    var day = 24 * 60 * 60 * 1000;
    var hour = 60 * 60 * 1000;
    var minute = 60 * 1000;

    var time = time2 * 1 - time1 * 1;
    var day1 = parseInt(time / day);//取整
    if (day1 >= 1) {//差值大于等于1天
        time = time - day1 * day;
    }

    var hour1 = parseInt(time / hour);//取整
    if (hour1 >= 1) {//差值大于等于1小时
        time = time - hour1 * hour;
    }

    var minute1 = parseInt(time / minute);//取整

    if (day1 > 0) {
        str += day1 + "天";
    }
    if (hour1 > 0) {
        str += hour1 + "小时";
    }
    if (minute1 >= 0) {
        str += minute1 + "分钟";
    }

    return str;
}
exports.TimeCount = TimeCount;
/**
 * groupQueue 组排队,组件串行，组内并发
 * @param str
 * @returns {boolean}
 */
function groupQueue(groupSize, queue, itemCb, doneCb) {
    var fail = [], succ = [];
    var ep = new EventProxy();
    function doGroup() {
        var group = [];
        var doCount = Math.min(groupSize, queue.length);
        var i;
        for (i = 0; i < doCount; i++) {
            group.push(queue.shift());
        }
        group.forEach(function (item) {
            itemCb(item, function (err, result) {
                if (!err) {
                    fail.push({ item: item, err: err });
                }
                else {
                    succ.push({ item: item, result: result });
                }
                ep.emit('itemDone');
            });
        });
        ep.after('itemDone', doCount, function () {
            ep.emit('groupDone');
        });
    }
    doGroup();
    ep.on('groupDone', function () {
        if (queue.length == 0) {
            return (doneCb({
                fail: fail,
                succ: succ
            }));
        }
        else {
            doGroup();
        }
    });
}
exports.groupQueue = groupQueue;
/**
 * isEmptyStr 判断字符串是否为空字符串
 * @param str
 * @returns {boolean}
 */
function isEmptyStr(str) {
    return !str || /^\s*$/.test(str);
}
exports.isEmptyStr = isEmptyStr;
/**
 * escapeRiskChar 判断字符串是否符合文件名格式
 * @param str
 * @returns {*}
 */
function escapeRiskChar(str) {
    if (str.length < 0 || str.length > 255) {
        return null;
    }
    else {
        return str.match(/^[^\\\/:\*\?\|"<>]+$/);
    }
}
exports.escapeRiskChar = escapeRiskChar;
/**
 * concatParams http 拼接get请求参数
 * @param keys
 * @param values
 * @returns {string}
 */
function concatParams(keys, values) {
    var param = "";
    for (var i = 0; i < keys.length; i++) {
        if (i === 0) {
            param += util.format("?%s=%s", keys[i], values[i]);
        }
        else {
            param += util.format("&%s=%s", keys[i], values[i]);
        }
    }
    return param;
}
exports.concatParams = concatParams;
function verifyFormat(str) {
    var splitarr = str.split(/[|,，。.?？:：]/);
    if (splitarr.length === 3) {
        var carnum = splitarr[0].trim();
        var c_result = carnum.match(/^[\u4e00-\u9fa5]{1}[a-zA-Z]{1}[a-zA-Z_0-9]{4}[a-zA-Z_0-9_\u4e00-\u9fa5]$/);
        var telephone = splitarr[1].trim();
        var t_result = telephone.match(/^0?(13[0-9]|15[012356789]|18[0-9]|14[57])[0-9]{8}/);
        if ((c_result && t_result) !== null) {
            return splitarr;
        }
        else {
            return null;
        }
    }
    else {
        return null;
    }
}
exports.verifyFormat = verifyFormat;
//# sourceMappingURL=hcUti.js.map
//方案2，算出某年某月多少天，查出该区多少个组，查出所有值班记录，填到对应组
function rebuildQuee(groupArr,dutyArr,month_date){
    var getDays = function(year, month) {
        // month 取自然值，从 1-12 而不是从 0 开始
        return new Date(year, month, 0).getDate()
    };
    var weekObj={'1':'星期一','2':'星期二','3':'星期三','4':'星期四','5':'星期五','6':'星期六','0':'星期日'};
    var groupArr=groupArr||[];
    var DutyArr=dutyArr||[];
    var year  =month_date.split('-')[0];
    var month =month_date.split('-')[1];
    var _len  =getDays(year,month);
    var _lenx =DutyArr.length;
    var queeArr=[];
    for(var i=0;i<_len;i++){
        var a=(i+1).toString();
        if(a<10) a='0'+a;
        var ymd=month_date+'-'+a;
        var tmobj={
            //_id:i+1,//序号
            weekday:weekObj[new Date(ymd).getDay()],//周期
            duty_day:ymd
        };
        //for(var j=0;j<_lenx;j++){
        //    tmobj[DutyArr[j].scheid]='';
        //}
        queeArr[queeArr.length]=tmobj;
    }
    for(var m=0;m<DutyArr.length;m++){
        for(var z=0;z<queeArr.length;z++){
            if(DutyArr[m].duty_day==queeArr[z].duty_day){
                //queeArr[j][DutyArr[m].group_id]=DutyArr[m].name_phone_json
                var npj=JSON.parse(DutyArr[m].name_phone_json);
                var npjstr='';
                for(var k in npj){
                    k+=',';
                    npjstr+=k;
                }
                var _npjstr=npjstr.substr(0,npjstr.length-1);
                //queeArr[z][DutyArr[m].scheid]=DutyArr[m].name_phone_json;
                queeArr[z][DutyArr[m].sche_id]=_npjstr;
            }
        }
    }
    return queeArr;
}
exports.rebuildQuee=rebuildQuee;

function rebuildQueeTem(groupArr,month_date){
    var getDays = function(year, month) {
        // month 取自然值，从 1-12 而不是从 0 开始
        return new Date(year, month, 0).getDate()
    };
    var weekObj={'1':'星期一','2':'星期二','3':'星期三','4':'星期四','5':'星期五','6':'星期六','0':'星期日'};
    var groupArr=groupArr||[];
    var year  =month_date.split('-')[0];
    var month =month_date.split('-')[1];
    var _len  =getDays(year,month);
    var queeArr=[];
    for(var i=0;i<_len;i++){
        var a=(i+1).toString();
        if(a<10) a='0'+a;
        var ymd=month_date+'-'+a;
        var tmobj={
            //_id:i+1,//序号
            weekday:weekObj[new Date(ymd).getDay()],//周期
            duty_day:ymd
        };
        //for(var j=0;j<_lenx;j++){
        //    tmobj[DutyArr[j].scheid]='';
        //}
        queeArr[queeArr.length]=tmobj;
    }
    return queeArr;
}
exports.rebuildQueeTem=rebuildQueeTem;