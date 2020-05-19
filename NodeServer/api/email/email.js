
var schedule = require('node-schedule');
var nodemailer = require('nodemailer');
//var db= require('../../api_v2/libs/db');
var EventProxy = require("eventproxy");
var path = require('path');
var File = require('../libs/File');
var hcUti = require('../libs/hcUti');
var request=require('request');
var settings=require('../../settings');
var mysql = require('mysql');
//var ssApi = require('../api/ss/SupervisionSystem');
var EmailSet=true;//true开启定时发送
var EmailDate =[];
var EmailDate0 =[];
var EmailDate1 =[];
var EmailStr='';
var KanText='查勘员基础统计邮箱定时发送_';
var BaseText='基础统计邮箱定时发送_';
var Excelhour=12;//定时创建excel的小时
var Excelminute=58;//定时创建excel的分钟
var Emailhour=12;//定时发送邮箱的小时
var Emailminute=59;//定时发送邮箱的分钟
var EmailEvent=new EventProxy();
module.exports={
	init:function(){
		console.log('initemail');

		var Me=this;
		if(EmailSet){
			console.log('创建Excel'+Excelhour+":"+Excelminute);
			console.log('发送邮箱时间'+Emailhour+":"+Emailminute);
			Me.ExcelSet(Excelhour,Excelminute);//前面是小时，后面是分
			Me.EmailSet(Emailhour,Emailminute);//前面是小时，后面是分
		}else{
			Me.GetEmail();
			EmailEvent.all('getEmai0','getEmail',function(Email0,Email1){
				Me.ExcelNoSet(Email0,Email1);
			});
			EmailEvent.all('getEmai0','getEmail',function(Email0,Email1){
				(function(Me){
					setTimeout(function() {
						Me.EmailNoSet(Email0,Email1);
					},5000);
				})(Me);
			});
		}
	},
	//获取全局邮箱
	GetEmail:function(){
		//请求邮箱
		EmailDate0=[];
		EmailDate1=[];
		var _params = {};
		var url="http://127.0.0.1:"+settings.serverPort+"/api/SupervisionSystem/GetEmail";
		request.post(url, {form: _params}, function (err, reponse,body) {
			//console.log('creatExcel:err:',body);
			try{
				var _body=JSON.parse(body);
			}catch (error){
				_body={};
			}
			var _arr=_body.data;

			for (var i = 0; i < _arr.length; i++) {
				//console.log(_arr[i].AreaClass);
				if(_arr[i].AreaClass==1){
					EmailDate0[EmailDate0.length]=_arr[i];
				}else if(_arr[i].AreaClass==2){
					EmailDate1[EmailDate1.length]=_arr[i];
				}
				//console.log(JSON.stringify(EmailDate0)+"-"+JSON.stringify(EmailDate1));
			}
			var Email0=JSON.stringify(EmailDate0);
			var Email1=JSON.stringify(EmailDate1);
			//console.log(EmailDate1.length);
			EmailEvent.emit('getEmai0',Email0);
			EmailEvent.emit('getEmail',Email1);
		});
	},
	//设置excel时间
	ExcelSet:function(h2,m2){
		var rule1 = new schedule.RecurrenceRule();
		rule1.dayOfWeek = [0, new schedule.Range(1, 6)];
		rule1.hour =h2;
		rule1.minute = m2;
		var Me=this;
		var j = schedule.scheduleJob(rule1, function(){
			Me.GetEmail();
			EmailEvent.all('getEmai0','getEmail',function(Email0,Email1){
				Me.ExcelNoSet(Email0,Email1);
			});
		});
	},
	//创建查勘员excel数据
	getExcelKan:function(AreaName,AreaClass,Area1Code,Area2Code,cb){
		//console.log(AreaName+"勘察员Excel创建");
		var dd = new Date();
		var y = dd.getFullYear();
		var m = dd.getMonth();
		var d = dd.getDate()-1;//产生昨天的excel
		var StartTime=new Date(y,m,d,0,0,0).getTime();
		var EndTime=new Date(y,m,d,23,59,59).getTime();
		var KeyWords="";
		var Comclass=AreaClass.toString();
		var Area1Code=Area1Code.toString();
		var Area2Code=Area2Code.toString();
		var AreaName=AreaName.toString();
		var dz = dd.getDate()-1;
		var ctime=y+"-"+(m+1)+"-"+dz;
		var FileName;
		FileName=AreaName+KanText+ctime;
		//console.log("kan"+FileName);
		var _params = {
			'StartTime':StartTime,
			'EndTime':EndTime,
			'KeyWords':KeyWords,
			'Comclass':Comclass,
			'Comcode':Area1Code,
			'Area2Code':Area2Code,
			'FileName': FileName,
			'RandomTag': Math.random()
		};
		var url="http://127.0.0.1:"+settings.serverPort+"/api/SupervisionSystem/GetEmailExcel";
		request.post(url, {form: _params}, function (err, reponse,body) {
			//console.log("xsl返回结果",body);
			//try{
			//	var _body=JSON.parse(body);
			//}catch (error){
            //
			//	_body={};
			//	return cb(true,null);
			//}
			if(JSON.parse(body).success){
				return cb(null,true);
			}else{
				return cb(true,null);
			}

		});
	},
	//基础统计excel数据
	getExcel:function(AreaName,AreaClass,Area1Code,Area2Code,cb){
		//console.log(AreaName+"基础的Excel创建");
		var dd = new Date();
		var y = dd.getFullYear();
		var m = dd.getMonth();
		var d = dd.getDate()-1;//产生昨天的excel
		var StartTime=new Date(y,m,d,0,0,0).getTime();
		var EndTime=new Date(y,m,d,23,59,59).getTime();
		var KeyWords="";
		var Comclass=AreaClass.toString();
		var Area1Code=Area1Code.toString();
		var Area2Code=Area2Code.toString();
		var AreaName=AreaName.toString();
		var dd = new Date();
		var y = dd.getFullYear();
		var m = dd.getMonth();//获取当前月份的日期
		var dz = dd.getDate()-1;
		var ctime=y+"-"+(m+1)+"-"+dz;
		var FileName1;
		FileName1=AreaName+BaseText+ctime;
		//console.log("base"+FileName1)
		var _params1 = {
			'StartTime':StartTime,
			'EndTime':EndTime,
			'KeyWords':KeyWords,
			'Comclass':Comclass,
			'Area1Code':Area1Code,
			'Area2Code':Area2Code,
			'FileName': FileName1,
			'RandomTag': Math.random()
		};
		//console.log("提交之前基础统计邮箱发送参数111:"+Comclass+"-"+Area1Code+"-"+Area2Code);
		var url1="http://127.0.0.1:"+settings.serverPort+"/api/SupervisionSystem/BaseEmailExcel";
		request.post(url1, {form: _params1}, function (err, reponse,body) {
			try{
				var _body=JSON.parse(body);
			}catch (error){
				_body={};
				return cb(true,null);
			}
			if(_body.success){
				//console.log("创建"+FileName1+"表格成功")
				return cb(null,true);
			}else{
				return cb(true,null);
			}

		});
	},
	//创建不同的excel条件判断
	ExcelNoSet:function(Email0,Email1){
		//console.log("ExcelNoSet接口");

		var Me=this;
		Email0=JSON.parse(Email0);
		Email1=JSON.parse(Email1);
		var arr = [];
		var sendFlag_1=true;
		var sendFlag_2=true;
		if(Email0.length>0){

			Me.Excelcb(0,Email0,function(err,result){
			});
			Me.KanExcelcb(0,Email0,function(err,result){
			});
		}
		if(Email1.length>0){
			Me.Excelcb(0,Email1,function(err,result){
			});
			Me.KanExcelcb(0,Email1,function(err,result){
			});
		}
	},
	//基础excel导出
	Excelcb:function(n,Email,cb){
		//console.log(n+"------"+JSON.stringify(Email));
		var Me= this;
		var AreaClass = Email[n].AreaClass;
		var Area1Code = Email[n].Area1Code;
		var Area2Code = Email[n].Area2Code;
		var AreaName = Email[n].AreaName;
		//console.log("基础"+n+"------"+Email[n].AreaName);
		//console.log("基础"+Email.length);
		Me.getExcel(AreaName,AreaClass,Area1Code,Area2Code,function(err,result){
			if(n+1<Email.length){
				Me.Excelcb(n+1,Email,cb);
			}
		});
	},
	//查勘员excel导出
	KanExcelcb:function(n,Email,cb){
		//console.log(n+"------"+JSON.stringify(Email));
		var Me= this;
		var AreaClass = Email[n].AreaClass;
		var Area1Code = Email[n].Area1Code;
		var Area2Code = Email[n].Area2Code;
		var AreaName = Email[n].AreaName;
		//console.log("查勘员"+n+"------"+Email[n].AreaName);
		//console.log("查勘员"+Email.length);
		Me.getExcelKan(AreaName,AreaClass,Area1Code,Area2Code,function(err,result){
			if(n+1<Email.length){
				Me.KanExcelcb(n+1,Email,cb);
			}
		});
	},
	//设置邮箱时间
	EmailSet:function(h1,m1){

		var rule = new schedule.RecurrenceRule();
		rule.dayOfWeek = [0, new schedule.Range(1, 6)];
		rule.hour = h1;
		rule.minute = m1;
		var Me=this;
		var j = schedule.scheduleJob(rule, function(){
			Me.GetEmail();
			EmailEvent.all('getEmai0','getEmail',function(Email0,Email1){
				Me.EmailNoSet(Email0,Email1);
			});
		});
	},
	//给不同的人发email的判断条件
	EmailNoSet:function(Email0,Email1){
		var Me=this;
		Email0=JSON.parse(Email0);
		Email1=JSON.parse(Email1);
		if(Email0.length>0){
			Me.Emailcb(0,Email0);
		}
		if(Email1.length>0){
			Me.Emailcb(0,Email1);
		}
	},
	//递归发送emai
	Emailcb:function(n,Email){

		var Me= this;
		var dd = new Date();
		var y = dd.getFullYear();
		var m = dd.getMonth()+1;//获取当前月份的日期
		var d = dd.getDate()-1;//正式使用要减个1
		var ctime=y+"-"+m+"-"+d;
		var AreaClass = Email[n].AreaClass;
		var Area1Code = Email[n].Area1Code;
		var Area2Code = Email[n].Area2Code;
		var AreaEmail= Email[n].AreaEmail;
		var AreaName= Email[n].AreaName;
		//console.log(n+"次"+AreaName);
		var FileName= AreaName+KanText+ctime;;//查勘员表格
		var FileName1=AreaName+BaseText+ctime;//基础表格


		Me.sendEmail(AreaEmail,FileName,FileName1,function(err,result){
			if(n+1<Email.length){
				Me.Emailcb(n+1,Email);
			}else{
				//console.log("jjj");
			}
		});
	},
	//执行发送email
	sendEmail:function(qq,filename,filename1,cb){
		//console.log("sendEmail");
		var Me=this;
		var transporter = nodemailer.createTransport({
			service: 'qq',
			auth: {
				user: '493891498@qq.com',
				pass: 'efruxrvlnszibicj' //授权码,通过QQ获取
			}
		});
		var mailOptions = {
			from: '493891498@qq.com', // 发送者
			to: qq, // 接受者,可以同时发送多个,以逗号隔开
			subject: '服务质量评估管理统计报表', // 标题
			//text: 'Hello world', // 文本
			html: '<h2>报表相关详细信息，请查看附件</h2>',
			attachments:[
				{
					filename :filename+'.xlsx',
					path: './web/excel/'+filename+'.xlsx'
					//encoding:"utf-8"
				},
				{
					filename :filename1+'.xlsx',
					path: './web/excel/'+filename1+'.xlsx'
					//encoding:"utf-8"
				}
			]
		};
		transporter.sendMail(mailOptions, function (err, info) {
			if (err) {
				//console.log(err);
				console.log(qq+"该邮箱未发送成功");
				//Me.ExcelNoSet();
				//Me.EmailSet(09,Emailminute+1);//前面是小时，后面是分
				return;
			}
			console.log("给"+qq+"发送成功");
			return cb(null,true);
		});
	}
};

