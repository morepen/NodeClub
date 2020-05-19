(function() {
    module.exports = {
        cookie_secret: 'secret_nodedemo',
        serverPort: 3000,
        mysql: {
            database: 'hbtbwechat',
            host: '192.168.1.64',
            user: 'assist',
            password: 'ipcamera',
            port: 3306,
            connectionLimit: 120,
            multipleStatements: true
        },
        sign_url:'http://127.0.0.1:8080/Token/servlet/GetEncrypt',
        test_aesKey:'4020100ceshi0001',
        online_aesKey:'4020100PAYURL417',

        //url_getToken:'http://cxhbwx.cpic.com.cn/tbwechat/wechat/image_upload',//test
        //proxy_url:null, //test
        url_getToken:'http://10.187.231.220:807/wechat/image_upload',//product
        proxy_url:'http://10.187.184.205:8081',//product
        
       



    };
}).call(this);