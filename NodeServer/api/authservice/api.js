var schedule = require('../../node-schedule');

var rule = new schedule.RecurrenceRule();
        rule.dayOfWeek = [0, new schedule.Range(1, 6)];
        rule.hour = h1;
        rule.minute = m1;
        var Me=this;
        var j = schedule.scheduleJob(rule, function(){
           console.log("在"+h1+":"+m1+"开启定时服务");
            
});