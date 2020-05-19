(function() {
    var serviceRoute;
    serviceRoute = require('../api/service/route');
    publicRoute = require('../api/public/route');
    interfaceRoute = require('../api/interface/route');
    module.exports = function(app) {
        app.use('/service', serviceRoute);
        app.use('/public',publicRoute);
        app.use('/api/interface',interfaceRoute);

    };

}).call(this);