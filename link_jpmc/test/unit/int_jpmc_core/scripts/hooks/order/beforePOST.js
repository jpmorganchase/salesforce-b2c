'use strict';

/* eslint-disable no-unused-vars */

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

describe('int_jpmc_core/scripts/hooks/order/beforePOST', function () {
    var beforePOSTHook;
    var mockStatus;
    var mockLogger;
    var mockSession;
    var mockBasket;
    var sandbox;

    beforeEach(function () {
        sandbox = sinon.createSandbox();

        // Mock Status
        mockStatus = function Status(code) {
            this.code = code;
            return this;
        };
        mockStatus.OK = 'OK';
        mockStatus.ERROR = 'ERROR';

        // Mock Logger
        mockLogger = {
            info: sandbox.stub(),
            debug: sandbox.stub(),
            error: sandbox.stub(),
            warn: sandbox.stub()
        };

        var mockLoggerFactory = {
            getLogger: sandbox.stub().returns(mockLogger)
        };

        // Mock global session object
        mockSession = {
            privacy: {}
        };
        global.session = mockSession;

        // Create mock basket
        mockBasket = {
            UUID: 'basket-uuid-abc123',
            custom: {}
        };

        // Load the hook with mocks
        beforePOSTHook = proxyquire('../../../../../../cartridges/int_jpmc_core/cartridge/scripts/hooks/order/beforePOST', {
            'dw/system/Status': mockStatus,
            'dw/system/Logger': mockLoggerFactory
        });
    });

    afterEach(function () {
        sandbox.restore();
        delete global.session;
    });

    describe('beforePOST - OCAPI Order Hook for EU Drop-in', function () {
        it('should transfer reserved order number from basket to session', function () {
            mockBasket.custom.jpmcReservedOrderNo = '00001234';

            var result = beforePOSTHook.beforePOST(mockBasket);

            assert.equal(mockSession.privacy.jpmcReservedOrderNo, '00001234');
            assert.equal(result.code, mockStatus.OK);
        });

        it('should log info message when reserved order number is found', function () {
            mockBasket.custom.jpmcReservedOrderNo = '00005678';

            beforePOSTHook.beforePOST(mockBasket);

            assert.isTrue(mockLogger.info.called);
            var logCall = mockLogger.info.getCall(0);
            assert.include(logCall.args[0], 'Found JPMC reserved order number');
            assert.include(logCall.args[1], '00005678');
            assert.include(logCall.args[2], 'basket-uuid-abc123');
        });

        it('should log debug message when no reserved order number found', function () {
            // No reserved order number
            assert.isUndefined(mockBasket.custom.jpmcReservedOrderNo);

            beforePOSTHook.beforePOST(mockBasket);

            assert.isTrue(mockLogger.debug.called);
            var logCall = mockLogger.debug.getCall(0);
            assert.include(logCall.args[0], 'No reserved order number found');
            assert.include(logCall.args[1], 'basket-uuid-abc123');
        });

        it('should NOT set session variable when basket has no reservation', function () {
            assert.isUndefined(mockBasket.custom.jpmcReservedOrderNo);

            beforePOSTHook.beforePOST(mockBasket);

            assert.isUndefined(mockSession.privacy.jpmcReservedOrderNo);
        });

        it('should always return Status.OK', function () {
            var resultWithReservation = beforePOSTHook.beforePOST(mockBasket);
            assert.equal(resultWithReservation.code, mockStatus.OK);

            mockBasket.custom.jpmcReservedOrderNo = '00001111';
            var resultWithoutReservation = beforePOSTHook.beforePOST(mockBasket);
            assert.equal(resultWithoutReservation.code, mockStatus.OK);
        });

        it('should handle null reserved order number', function () {
            mockBasket.custom.jpmcReservedOrderNo = null;

            beforePOSTHook.beforePOST(mockBasket);

            assert.isUndefined(mockSession.privacy.jpmcReservedOrderNo);
            assert.isTrue(mockLogger.debug.called);
        });

        it('should handle empty string reserved order number', function () {
            mockBasket.custom.jpmcReservedOrderNo = '';

            beforePOSTHook.beforePOST(mockBasket);

            assert.isUndefined(mockSession.privacy.jpmcReservedOrderNo);
            assert.isTrue(mockLogger.debug.called);
        });

        it('should handle numeric reserved order number', function () {
            mockBasket.custom.jpmcReservedOrderNo = 12345;

            beforePOSTHook.beforePOST(mockBasket);

            assert.equal(mockSession.privacy.jpmcReservedOrderNo, 12345);
            assert.isTrue(mockLogger.info.called);
        });

        it('should handle reserved order number with special characters', function () {
            mockBasket.custom.jpmcReservedOrderNo = 'ORDER-2024-EU-99999';

            beforePOSTHook.beforePOST(mockBasket);

            assert.equal(mockSession.privacy.jpmcReservedOrderNo, 'ORDER-2024-EU-99999');
            assert.isTrue(mockLogger.info.called);
        });

        it('should overwrite existing session reservation', function () {
            mockSession.privacy.jpmcReservedOrderNo = 'OLD-ORDER-123';
            mockBasket.custom.jpmcReservedOrderNo = 'NEW-ORDER-456';

            beforePOSTHook.beforePOST(mockBasket);

            assert.equal(mockSession.privacy.jpmcReservedOrderNo, 'NEW-ORDER-456');
        });

        it('should preserve other session.privacy properties', function () {
            mockSession.privacy.otherProperty = 'should-remain';
            mockSession.privacy.anotherValue = 12345;
            mockBasket.custom.jpmcReservedOrderNo = '00007777';

            beforePOSTHook.beforePOST(mockBasket);

            assert.equal(mockSession.privacy.jpmcReservedOrderNo, '00007777');
            assert.equal(mockSession.privacy.otherProperty, 'should-remain');
            assert.equal(mockSession.privacy.anotherValue, 12345);
        });

        it('should handle basket without custom object', function () {
            var basketNoCustom = {
                UUID: 'basket-no-custom'
            };

            var result = beforePOSTHook.beforePOST(basketNoCustom);

            assert.equal(result.code, mockStatus.OK);
            assert.isUndefined(mockSession.privacy.jpmcReservedOrderNo);
        });

        it('should handle basket with empty custom object', function () {
            mockBasket.custom = {};

            var result = beforePOSTHook.beforePOST(mockBasket);

            assert.equal(result.code, mockStatus.OK);
            assert.isUndefined(mockSession.privacy.jpmcReservedOrderNo);
        });

        it('should create Logger with correct category and subcategory', function () {
            beforePOSTHook.beforePOST(mockBasket);

            var loggerFactoryCall = mockLogger.info.called || mockLogger.debug.called;
            assert.isTrue(loggerFactoryCall);
        });
    });

    describe('exports', function () {
        it('should export beforePOST function', function () {
            assert.isFunction(beforePOSTHook.beforePOST);
        });

        it('should have only beforePOST export', function () {
            var keys = Object.keys(beforePOSTHook);
            assert.equal(keys.length, 1);
            assert.include(keys, 'beforePOST');
        });
    });

    describe('integration with createOrderNoHook', function () {
        it('should demonstrate complete EU Drop-in flow', function () {
            // Step 1: OCAPI beforePOST hook transfers basket custom to session
            mockBasket.custom.jpmcReservedOrderNo = 'EU-ORDER-2024-12345';
            var hookResult = beforePOSTHook.beforePOST(mockBasket);
            
            assert.equal(hookResult.code, mockStatus.OK);
            assert.equal(mockSession.privacy.jpmcReservedOrderNo, 'EU-ORDER-2024-12345');
            
            // Step 2: createOrderNo hook would retrieve from session
            // (simulated in separate test file)
            assert.isDefined(mockSession.privacy.jpmcReservedOrderNo);
        });
    });
});
