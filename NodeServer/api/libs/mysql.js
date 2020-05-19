(function() {
    var Db, config, mysql, pool,
        __slice = [].slice;

    mysql = require('mysql');

    config = require('../../settings');

    pool = mysql.createPool(config.mysql);

    Db = (function() {
        function Db() {}

        Db.query = function() {
            var callback, str, _i;
            str = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), callback = arguments[_i++];
            if (process.env.debug) {
                console.log(str.join());
            }
            return pool.getConnection(function(err, connection) {
                if (err) {
                    return callback(err);
                }
                connection.query.apply(connection, __slice.call(str).concat([function(err, results, fields) {
                    connection.release();
                    return callback(err, results, fields);
                }]));
            });
        };

        return Db;

    })();

    module.exports = Db;

}).call(this);