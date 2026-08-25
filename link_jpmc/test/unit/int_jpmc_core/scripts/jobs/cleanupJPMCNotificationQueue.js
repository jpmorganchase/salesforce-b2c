'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();

describe('int_jpmc_core/scripts/jobs/cleanupJPMCNotificationQueue', function () {
    var job;
    var StatusMock;
    var LoggerMock;
    var TransactionMock;
    var CustomObjectMgrMock;
    var HelperMock;
    var closeCalled;
    var removedIds;
    var coStore;

    function makeStatusCtor() {
        function Status(code, key, msg) {
            this.code = code;
            this.key = key;
            this.msg = msg;
        }
        Status.OK = 0;
        Status.ERROR = 1;
        return Status;
    }

    function makeCO(messageId, status) {
        return { custom: { messageId: messageId, status: status } };
    }

    function makeQuery(cos) {
        var i = 0;
        return {
            getCount: function () { return cos.length; },
            hasNext: function () { return i < cos.length; },
            next: function () { return cos[i++]; },
            close: function () { closeCalled = true; }
        };
    }

    function load() {
        return proxyquire(
            '../../../../../cartridges/int_jpmc_core/cartridge/scripts/jobs/cleanupJPMCNotificationQueue',
            {
                'dw/system/Status': StatusMock,
                'dw/system/Logger': LoggerMock,
                'dw/system/Transaction': TransactionMock,
                'dw/object/CustomObjectMgr': CustomObjectMgrMock,
                '*/cartridge/scripts/helpers/JPMCNotificationsHelper': HelperMock
            }
        );
    }

    beforeEach(function () {
        StatusMock = makeStatusCtor();
        closeCalled = false;
        removedIds = [];
        coStore = {};

        LoggerMock = {
            getLogger: function () {
                return {
                    info: function () {}, warn: function () {},
                    error: function () {}, debug: function () {}
                };
            }
        };

        TransactionMock = { wrap: function (cb) { return cb(); } };

        CustomObjectMgrMock = {
            _query: makeQuery([]),
            queryCustomObjects: function () { return CustomObjectMgrMock._query; },
            getCustomObject: function (type, id) {
                return Object.prototype.hasOwnProperty.call(coStore, id) ? coStore[id] : null;
            },
            remove: function (co) { removedIds.push(co.custom.messageId); }
        };

        HelperMock = {
            NOTIFICATION_QUEUE_TYPE: 'JPMCDropInOrdersNotifications',
            STATUS_FAILED: 'FAILED',
            STATUS_ERROR: 'ERROR',
            STATUS_ACK_FAILED: 'ACK_FAILED'
        };

        job = load();
    });

    it('should export an execute function', function () {
        assert.isFunction(job.execute);
    });

    it('should remove stale records and return OK', function () {
        var cos = [makeCO('id1', 'FAILED'), makeCO('id2', 'ERROR')];
        coStore.id1 = cos[0];
        coStore.id2 = cos[1];
        CustomObjectMgrMock._query = makeQuery(cos);

        var result = job.execute({});
        assert.equal(result.code, StatusMock.OK);
        assert.deepEqual(removedIds, ['id1', 'id2']);
        var summary = JSON.parse(result.msg);
        assert.equal(summary.queried, 2);
        assert.equal(summary.removed, 2);
        assert.equal(summary.failed, 0);
    });

    it('should default retention to 30 days when no parameter is given', function () {
        var summary = JSON.parse(job.execute({}).msg);
        assert.equal(summary.retentionDays, 30);
    });

    it('should honor a valid retentionDays parameter', function () {
        var summary = JSON.parse(job.execute({ retentionDays: 7 }).msg);
        assert.equal(summary.retentionDays, 7);
    });

    it('should read retentionDays from a HashMap-style parameters object', function () {
        var params = { get: function (k) { return k === 'retentionDays' ? '14' : null; } };
        var summary = JSON.parse(job.execute(params).msg);
        assert.equal(summary.retentionDays, 14);
    });

    it('should fall back to the default on an invalid retentionDays', function () {
        var summary = JSON.parse(job.execute({ retentionDays: 'not-a-number' }).msg);
        assert.equal(summary.retentionDays, 30);
    });

    it('should close the query iterator', function () {
        job.execute({});
        assert.isTrue(closeCalled);
    });

    it('should return ERROR when the query throws', function () {
        CustomObjectMgrMock.queryCustomObjects = function () { throw new Error('query boom'); };
        var result = job.execute({});
        assert.equal(result.code, StatusMock.ERROR);
        assert.equal(JSON.parse(result.msg).error, 'query boom');
    });

    it('should not throw when a targeted CO is already gone', function () {
        CustomObjectMgrMock._query = makeQuery([makeCO('id1', 'FAILED')]); // coStore empty
        var result = job.execute({});
        assert.equal(result.code, StatusMock.OK);
        assert.deepEqual(removedIds, []);
    });
});
