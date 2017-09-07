var Jobs = function(connection, queueName, logger) {
	this.connection = connection;
	this.queueName = queueName;
	this.logger = require('./logger.js')(logger);
    };
var Promise = require('bluebird');
var amqp = require('amqp');

Jobs.prototype.queue = function(job, jobOptions) {
	return new Promise ((resolve, reject) => {
		var self = this;
		var exchangeOptions = { type: 'direct', durable: true, autoDelete: false, confirm: true };
		self.connection.exchange(self.queueName, exchangeOptions, function(exchange) {
			var options = { headers: { retry: 1, delay: 1000, timeAdded: Date.now() } };
			if (jobOptions !== undefined) {
			    if (jobOptions.priority !== undefined) { options.priority = jobOptions.priority; }
			    if (jobOptions.delay !== undefined) { options.headers.delay = jobOptions.delay; }
			    if (jobOptions.delayStrategy !== undefined) { options.headers.delayStrategy = jobOptions.delayStrategy; }
			    if (jobOptions.retry !== undefined) { options.headers.retry = jobOptions.retry; }
			    if (jobOptions.expire !== undefined) { options.expiration = String(jobOptions.expire); }
			}
			self.logger.info('publishing ' + JSON.stringify(job) + ' with ' + JSON.stringify(options));
			exchange.publish('', JSON.stringify(job), options, function(failed, error) {
				if (failed === false) { resolve(true); }
				else { reject(error); }
			    });
		    });
	    });
    };

Jobs.prototype.worker = function(worker) {
	var self = this;
	self.connection.exchange(self.queueName, { type: 'direct', durable: true, autoDelete: false }, function(exchange) {
		self.logger.info('Jobs exchange "%s" established for jobs worker', self.queueName);
		self.connection.queue(self.queueName, { durable: true, autoDelete: false }, function(queue) {
			self.logger.info('Created queue "%s" to receive jobs', self.queueName);
			queue.bind(exchange, '');
			queue.subscribe({ ack: true, prefetchCount: 1 }, function (message, headers, deliveryInfo, ack) {
				var msg = JSON.parse(message.data);
				self.logger.info('Processing message "%j" ("%j") @%s', msg, headers, self.queueName);
				worker(msg, function(err) {
					if (!err) {
					    self.logger.info('Worker executed job successfully. Message is acknowledged');
					    ack.acknowledge();
					} else {
					    self.logger.info('Worker answered with error %s. Message is not acknowledged', err);
					    var ctx = {
						    delay: deliveryInfo.headers.delay || 1000,
						    delayStrategy: deliveryInfo.headers.delayStrategy || 'linear',
						    expire: deliveryInfo.headers.expiration || false,
						    now: Date.now(),
						    retry: deliveryInfo.headers.retry,
						    dateScheduled: deliveryInfo.headers.timeAdded || Date.now()
						};
					    if (ctx.expire !== false && (ctx.now > ctx.dateScheduled + ctx.expire)) {
						self.logger.info('discarding expired job');
						ack.reject(false);
					    } else {
						var currentRetry = 1;
						var nextWait = ctx.delay;
						if (ctx.delayStrategy === 'exponential') {
						    for (var diff = Math.round(ctx.now - ctx.dateScheduled); diff > 0; currentRetry++) {
							var incr = Math.round(Math.exp(nextWait / 1000) * 1000);
							if (incr === Infinity) { break; }
							diff -= incr;
							nextWait = incr;
						    }
						} else if (ctx.delayStrategy === 'incremental') {
						    for (var diff = Math.round(ctx.now - ctx.dateScheduled); diff > 0; currentRetry++) { diff -= (currentRetry * ctx.delay); }
						    nextWait = (currentRetry + 1) * ctx.delay;
						} else { currentRetry = Math.round((ctx.now - ctx.dateScheduled) / ctx.delay) || 1; }
						if (currentRetry > ctx.retry) {
						    self.logger.info('discarding job, retry limit reached (' + currentRetry + '/' + ctx.retry + ')');
						    ack.reject(false);
						} else {
						    self.logger.info('should re-schedule job after ' + nextWait + ' retry ' + currentRetry + ' of ' + ctx.retry);
						    setTimeout(() => {
							    self.logger.info('re-queueing job');
							    ack.reject(true);
							}, nextWait);
						}
					    }
					}
				    });
			    });
		    });
	    });
    };

module.exports = function(connection, exchange, logger) { return new Jobs(connection, exchange, logger); };
