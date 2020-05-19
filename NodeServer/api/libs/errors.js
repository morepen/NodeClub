(function() {
    var errors;
    errors = {
        4040:{
            name: 'miss interface',
            message: '接口不存在'
        }
        ,4041: {
            name: 'miss param',
            message: '缺乏参数'
        },
        50003:{
          name: 'miss err',
           message: '接口异常'  
        }
    };

    module.exports = errors;

}).call(this);
