const Jobs = require('../index.js');
const expect = require('expect');
const queueUrl = (process.env.APQM_PROTO || 'amqp') + '://'
		+ (process.env.AMQP_HOST || '127.0.0.1') + ':'
		+ (process.env.AMQP_PORT || 5672);

describe('check I can schedule jobs', () => {
	it('schedules jobs', done => {
		const conn = require('amqp').createConnection({ url: queueUrl });
		conn.on('error', function(e) { done(e); });
		conn.on('ready', function() {
			let somelistener = new Jobs(conn, 'testouane');
			somelistener.worker(function(msg, ack) {
				expect(msg.hello).toBe('world');
				ack();
				done();
			    });
			setTimeout(() => {
				somelistener.queue({ hello: 'world' })
				    .then(() => { console.log('job queued'); })
				    .catch((e) => { done(e); });
			    }, 1200);
		    });
	    }).timeout(3000);

	it('does not re-schedule job', done => {
		const conn = require('amqp').createConnection({ url: queueUrl });
		conn.on('error', function(e) { done(e); });
		conn.on('ready', function() {
			let somelistener = new Jobs(conn, 'testtoo');
			somelistener.worker(function(msg, ack) {
				expect(msg.hello).toBe('world');
				console.log('ack-reject');
				ack('rejected');
				console.log('post-ack-reject');
				done(); //should fail if called twice (? AFAIR)
			    });
			setTimeout(() => {
				somelistener.queue({ hello: 'world' }, { retry: 0 })
				    .then(() => { console.log('job queued'); })
				    .catch((e) => { done(e); });
			   }, 1200);
		    });
	    }).timeout(3000);

	it('does re-schedule job', done => {
		const conn = require('amqp').createConnection({ url: queueUrl });
		conn.on('error', function(e) { done(e); });
		conn.on('ready', function() {
			let somelistener = new Jobs(conn, 'testtri');
			let doResolve = false;
			somelistener.worker(function(msg, ack) {
				expect(msg.hello).toBe('world');
				if (doResolve) {
				    ack();
				    done();
				} else {
				    ack('rejected');
				    doResolve = true;
				}
			    });
			setTimeout(() => {
				somelistener.queue({ hello: 'world' })
				    .then(() => { console.log('job queued'); })
				    .catch((e) => { done(e); });
			   }, 1200);
		    });
	    }).timeout(3000);
    });
