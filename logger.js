class myLogger {
    /**
     * @param {Object} logger
     * @param {String}
     */
    constructor(logger) {
	if (logger !== undefined) {
	    this._logger = logger;
	} else {
	    const logTransports = [];
	    const winston = require('winston');
	    logTransports.push(new winston.transports.Console({ colorize: true }));
	    this._logger = new (winston.Logger)({ transports: logTransports });
	}
    }

    /**
     * @returns {Object}
     */
    get logger() {
        return this._logger;
    }
}

module.exports = (logger) => new myLogger(logger).logger;
