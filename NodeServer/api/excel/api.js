var XLSXWriter = require('../../node_modules/xlsx-writestream');

var File = require('../libs/File');
var path = require('path');             

            var excel = [];
            var excel_json={
                 "机构":"test"                
            };            
            excel.push(
                excel_json
            ); 
            var filename=new Date().getTime();
            var employeePath = path.join(__dirname, '../../web/excel');
            console.log(employeePath);
            var fullPath = File.joinfilePath([employeePath,filename + ".xlsx"]);
            console.log(fullPath);
            XLSXWriter.write(fullPath, excel, function (err,result) {
                        
                        if(err){
                            
                        }else{
						     var _url="excel/"+filename + ".xlsx";
                             File.prototype.deleteFile(fullPath,30000,function(err1,result1){
                                console.log(err1);
                                console.log(result1);
                             });
							 
                            //return Me.cb(200, null, "../excel/"+filename + ".xlsx");
                        }
              });