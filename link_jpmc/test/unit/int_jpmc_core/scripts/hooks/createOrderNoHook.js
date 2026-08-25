'use strict';

/* eslint-disable no-unused-vars */

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

describe('int_jpmc_core/scripts/hooks/createOrderNoHook', function () {
    var createOrderNoHook;
    var mockOrderMgr;
    var mockSession;
    var sandbox;

    beforeEach(function () {
        sandbox = sinon.createSandbox();

        // Mock OrderMgr
        mockOrderMgr = {
            createOrderSequenceNo: sandbox.stub().returns('00009876')
        };

        // Mock global session object
        mockSession = {
            privacy: {}
        };
        global.session = mockSession;

        // Load the hook with mocks
        createOrderNoHook = proxyquire('../../../../../cartridges/int_jpmc_core/cartridge/scripts/hooks/createOrderNoHook', {
            'dw/order/OrderMgr': mockOrderMgr
        });
    });

    afterEach(function () {
        sandbox.restore();
        delete global.session;
    });

    describe('createOrderNo - EU Drop-in Reserved Order Number Flow', function () {
        it('should return reserved order number from session when present', function () {
            mockSession.privacy.jpmcReservedOrderNo = '00001234';

            var orderNo = createOrderNoHook.createOrderNo();

            assert.equal(orderNo, '00001234');
            assert.isFalse(mockOrderMgr.createOrderSequenceNo.called);
        });

        it('should clear session variable after using reserved order number', function () {
            mockSession.privacy.jpmcReservedOrderNo = '00005678';

            createOrderNoHook.createOrderNo();

            assert.isUndefined(mockSession.privacy.jpmcReservedOrderNo);
        });

        it('should generate new order sequence number when no reservation exists', function () {
            // No reserved order number in session
            assert.isUndefined(mockSession.privacy.jpmcReservedOrderNo);

            var orderNo = createOrderNoHook.createOrderNo();

            assert.equal(orderNo, '00009876');
            assert.isTrue(mockOrderMgr.createOrderSequenceNo.called);
        });

        it('should return string type for reserved order number', function () {
            mockSession.privacy.jpmcReservedOrderNo = 12345; // numeric

            var orderNo = createOrderNoHook.createOrderNo();

            assert.isString(orderNo);
            assert.equal(orderNo, '12345');
        });

        it('should return string type for generated order number', function () {
            mockOrderMgr.createOrderSequenceNo.returns(54321); // numeric return

            var orderNo = createOrderNoHook.createOrderNo();

            assert.isString(orderNo);
            assert.equal(orderNo, '54321');
        });

        it('should handle empty string reservation gracefully', function () {
            mockSession.privacy.jpmcReservedOrderNo = '';

            var orderNo = createOrderNoHook.createOrderNo();

            // Empty string is falsy, should fall back to sequence generation
            assert.equal(orderNo, '00009876');
            assert.isTrue(mockOrderMgr.createOrderSequenceNo.called);
        });

        it('should handle null reservation gracefully', function () {
            mockSession.privacy.jpmcReservedOrderNo = null;

            var orderNo = createOrderNoHook.createOrderNo();

            assert.equal(orderNo, '00009876');
            assert.isTrue(mockOrderMgr.createOrderSequenceNo.called);
        });

        it('should handle multiple sequential calls correctly', function () {
            // First call with reservation
            mockSession.privacy.jpmcReservedOrderNo = '00001111';
            var firstOrder = createOrderNoHook.createOrderNo();
            assert.equal(firstOrder, '00001111');
            assert.isUndefined(mockSession.privacy.jpmcReservedOrderNo);

            // Second call without reservation (should generate new)
            var secondOrder = createOrderNoHook.createOrderNo();
            assert.equal(secondOrder, '00009876');
            assert.isTrue(mockOrderMgr.createOrderSequenceNo.called);
        });

        it('should preserve other session.privacy properties', function () {
            mockSession.privacy.jpmcReservedOrderNo = '00002222';
            mockSession.privacy.otherProperty = 'should-remain';
            mockSession.privacy.anotherProperty = 12345;

            createOrderNoHook.createOrderNo();

            assert.isUndefined(mockSession.privacy.jpmcReservedOrderNo);
            assert.equal(mockSession.privacy.otherProperty, 'should-remain');
            assert.equal(mockSession.privacy.anotherProperty, 12345);
        });

        it('should handle reserved order number with special characters', function () {
            mockSession.privacy.jpmcReservedOrderNo = 'ORDER-2024-EU-12345';

            var orderNo = createOrderNoHook.createOrderNo();

            assert.equal(orderNo, 'ORDER-2024-EU-12345');
            assert.isFalse(mockOrderMgr.createOrderSequenceNo.called);
        });

        it('should handle boolean true as truthy reservation value', function () {
            mockSession.privacy.jpmcReservedOrderNo = true;

            var orderNo = createOrderNoHook.createOrderNo();

            assert.isString(orderNo);
            assert.equal(orderNo, 'true');
            assert.isFalse(mockOrderMgr.createOrderSequenceNo.called);
        });
    });

    describe('exports', function () {
        it('should export createOrderNo function', function () {
            assert.isFunction(createOrderNoHook.createOrderNo);
        });

        it('should have only createOrderNo export', function () {
            var keys = Object.keys(createOrderNoHook);
            assert.equal(keys.length, 1);
            assert.include(keys, 'createOrderNo');
        });
    });
});
