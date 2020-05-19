var request=require('request');
var sign_url="http://127.0.0.1:8080/Token/servlet/GetSign";
var sign_str1="4ot2hTksFZkdzKMlmobilePhone17621236712unionIdoQMKot0SW60CpCNwrxPPLpJaIVoI4ot2hTksFZkdzKMl"
request.post(sign_url,{form:{sign_str:sign_str1}},function(err,response,body){
 console.log('body:',body);
})