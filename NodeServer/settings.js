(function() {
    module.exports = {
        cookie_secret: 'secret_nodedemo',
        serverPort: 3000,
        mysql: {
            database: 'hbtbwechat',
            host: '127.0.0.1',
            user: 'assist',
            password: 'ipcamera',
            port: 3306,
            connectionLimit: 120,
            multipleStatements: true
        },
        sign_url:'http://127.0.0.1:8080/Token/servlet/GetEncrypt',
        test_aesKey:'',
        online_aesKey:'',

        //url_getToken:'http://cxhbwx.cpic.com.cn/tbwechat/wechat/image_upload',//test
        //proxy_url:null, //test
        url_getToken:'http://127.0.0.1:807/wechat/image_upload',//product
        proxy_url:'http://127.0.0.1:8081',//product
        
       



    };
}).call(this);
