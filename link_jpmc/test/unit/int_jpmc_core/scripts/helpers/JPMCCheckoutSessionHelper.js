'use strict';

/* eslint-disable no-unused-vars */

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

describe('int_jpmc_core/scripts/helpers/JPMCCheckoutSessionHelper', function () {
    var JPMCCheckoutSessionHelper;
    var mockLogger;
    var mockOrderMgr;
    var mockTransaction;
    var mockJPMCConfig;
    var mockJPMCCheckoutIntentService;
    var mockJPMCMerchantResolver;
    var mockBasket;
    var mockOrder;
    var sandbox;

    beforeEach(function () {
        sandbox = sinon.createSandbox();

        // Mock Logger
        mockLogger = {
            error: sandbox.stub(),
            warn: sandbox.stub(),
            info: sandbox.stub(),
            debug: sandbox.stub()
        };

        // Mock OrderMgr
        mockOrderMgr = {
            createOrderSequenceNo: sandbox.stub().returns('00001234'),
            searchOrders: sandbox.stub()
        };

        // Mock Transaction
        mockTransaction = {
            wrap: sandbox.stub().callsFake(function (callback) {
                return callback();
            })
        };

        // Mock JPMCConfig
        mockJPMCConfig = {
            getCaptureMethod: sandbox.stub().returns('MANUAL'),
            getCheckoutMode: sandbox.stub().returns('DROP_IN'),
            getPreference: sandbox.stub().callsFake(function (key, defaultValue) {
                if (key === 'JPMCSaveConsumerProfile') {
                    return true;
                }
                return defaultValue;
            }),
            is3DSEnabled: sandbox.stub().returns(false)
        };

        // Mock JPMCCheckoutIntentService
        mockJPMCCheckoutIntentService = {
            createCheckoutSession: sandbox.stub().returns({
                success: true,
                checkoutSessionToken: 'token-123456',
                data: { sessionId: 'session-abc' }
            })
        };

        // Mock JPMCMerchantResolver
        mockJPMCMerchantResolver = {
            resolve: sandbox.stub().returns({
                merchantId: 'MERCHANT_123',
                saveConsumerProfile: true,
                jpmc3DSEnabled: false
            }),
            getCheckoutMode: sandbox.stub().returns('DROP_IN')
        };

        // Create mock basket
        mockBasket = {
            UUID: 'basket-uuid-123',
            getUUID: sandbox.stub().returns('basket-uuid-123'),
            custom: {
                jpmcReservedOrderNo: null,
                jpmcLastEtag: null,
                jpmcCheckoutIntentOrderNumber: null
            },
            getEtag: sandbox.stub().returns('etag-abc123'),
            getTotalGrossPrice: sandbox.stub().returns({
                getCurrencyCode: sandbox.stub().returns('USD'),
                getValue: sandbox.stub().returns(100.50),
                available: true
            }),
            getTotalTax: sandbox.stub().returns({
                getValue: sandbox.stub().returns(8.50),
                available: true
            }),
            getDefaultShipment: sandbox.stub().returns({
                getShippingTotalGrossPrice: sandbox.stub().returns({
                    getValue: sandbox.stub().returns(5.00),
                    available: true
                }),
                getShippingAddress: sandbox.stub().returns({
                    getFirstName: sandbox.stub().returns('John'),
                    getLastName: sandbox.stub().returns('Doe'),
                    getAddress1: sandbox.stub().returns('123 Main St'),
                    getCity: sandbox.stub().returns('New York'),
                    getStateCode: sandbox.stub().returns('NY'),
                    getPostalCode: sandbox.stub().returns('10001'),
                    getCountryCode: sandbox.stub().returns({ getValue: sandbox.stub().returns('US') })
                }),
                getShippingMethod: sandbox.stub().returns({
                    getID: sandbox.stub().returns('STANDARD'),
                    getDisplayName: sandbox.stub().returns('Standard Shipping')
                })
            }),
            getBillingAddress: sandbox.stub().returns({
                getFirstName: sandbox.stub().returns('John'),
                getLastName: sandbox.stub().returns('Doe'),
                getAddress1: sandbox.stub().returns('123 Main St'),
                getCity: sandbox.stub().returns('New York'),
                getStateCode: sandbox.stub().returns('NY'),
                getPostalCode: sandbox.stub().returns('10001'),
                getCountryCode: sandbox.stub().returns({ getValue: sandbox.stub().returns('US') }),
                getPhone: sandbox.stub().returns('555-1234')
            }),
            getCustomer: sandbox.stub().returns({
                isAnonymous: sandbox.stub().returns(true)
            }),
            getCustomerEmail: sandbox.stub().returns('test@example.com'),
            getAllProductLineItems: sandbox.stub().returns([{}, {}])
        };

        // Load the helper with mocks
        JPMCCheckoutSessionHelper = proxyquire('../../../../../cartridges/int_jpmc_core/cartridge/scripts/helpers/JPMCCheckoutSessionHelper', {
            'dw/system/Logger': {
                getLogger: sandbox.stub().returns(mockLogger)
            },
            'dw/order/OrderMgr': mockOrderMgr,
            'dw/system/Transaction': mockTransaction,
            '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig,
            '*/cartridge/scripts/services/JPMCCheckoutIntentService': mockJPMCCheckoutIntentService,
            '*/cartridge/scripts/helpers/JPMCMerchantResolver': mockJPMCMerchantResolver,
            'dw/util/Calendar': function Calendar() {
                this.add = sandbox.stub();
            }
        });
    });

    afterEach(function () {
        sandbox.restore();
    });

    // ─── buildIntentPayload ─────────────────────────────────────────────────

    describe('buildIntentPayload', function () {
        it('should throw error when order is null', function () {
            assert.throws(function () {
                JPMCCheckoutSessionHelper.buildIntentPayload(null);
            }, 'Order is required');
        });

        it('should build basic payload with required fields', function () {
            var payload = JPMCCheckoutSessionHelper.buildIntentPayload(mockBasket);

            assert.isObject(payload);
            assert.equal(payload.currencyCode, 'USD');
            assert.isString(payload.merchantOrderNumber);
            assert.isObject(payload.checkoutOptions);
            assert.equal(payload.checkoutOptions.authorization.authorizationType, 'AUTH_METHOD_CART_AMOUNT');
            assert.equal(payload.checkoutOptions.capture.captureMethod, 'CAPTURE_METHOD_MANUAL');
            assert.isObject(payload.cart);
            assert.equal(payload.cart.totalTransactionAmount, 10050); // 100.50 in cents
            assert.equal(payload.cart.taxAmount, 850); // 8.50 in cents
            assert.equal(payload.cart.totalShippingAmount, 500); // 5.00 in cents
            assert.isObject(payload.consumer);
            assert.equal(payload.consumer.email, 'test@example.com');
            assert.equal(payload.consumer.phone, '555-1234');
        });

        it('should map capture method NOW correctly', function () {
            mockJPMCConfig.getCaptureMethod.returns('NOW');
            var payload = JPMCCheckoutSessionHelper.buildIntentPayload(mockBasket);
            assert.equal(payload.checkoutOptions.capture.captureMethod, 'CAPTURE_METHOD_NOW');
        });

        it('should map capture method DELAYED to MANUAL for DROP_IN mode', function () {
            mockJPMCConfig.getCaptureMethod.returns('DELAYED');
            mockJPMCMerchantResolver.getCheckoutMode.returns('DROP_IN');
            var payload = JPMCCheckoutSessionHelper.buildIntentPayload(mockBasket);
            assert.equal(payload.checkoutOptions.capture.captureMethod, 'CAPTURE_METHOD_MANUAL');
        });

        it('should use custom merchantOrderNumber when provided in options', function () {
            var payload = JPMCCheckoutSessionHelper.buildIntentPayload(mockBasket, {
                merchantOrderNumber: 'CUSTOM-ORDER-123'
            });
            assert.equal(payload.merchantOrderNumber, 'CUSTOM-ORDER-123');
        });

        it('should include consumerProfileId for registered customers', function () {
            var registeredCustomer = {
                isAnonymous: sandbox.stub().returns(false),
                getProfile: sandbox.stub().returns({
                    getCustomerNo: sandbox.stub().returns('CUST-456'),
                    custom: {jpmcProfileId : 'PROFILE-789'}
                })
            };
            mockBasket.getCustomer.returns(registeredCustomer);

            var payload = JPMCCheckoutSessionHelper.buildIntentPayload(mockBasket);
            assert.equal(payload.consumer.consumerProfileId, 'PROFILE-789');
        });

        it('should include cardOnFile for registered customers in DROP_IN mode', function () {
            var registeredCustomer = {
                isAnonymous: sandbox.stub().returns(false),
                getProfile: sandbox.stub().returns({
                    getCustomerNo: sandbox.stub().returns('CUST-456'),
                    custom: {jpmcProfileId : 'PROFILE-789'}
                })
            };
            mockBasket.getCustomer.returns(registeredCustomer);
            mockJPMCMerchantResolver.getCheckoutMode.returns('DROP_IN');

            var payload = JPMCCheckoutSessionHelper.buildIntentPayload(mockBasket);
            assert.isObject(payload.checkoutOptions.cardOnFile);
            assert.equal(payload.checkoutOptions.cardOnFile.transactionType, 'COF_TRANSACTION_TYPE_UNSCHEDULED');
        });

        it('should include consumerProfileOptions when saveConsumerProfile is enabled', function () {
            var registeredCustomer = {
                isAnonymous: sandbox.stub().returns(false),
                getProfile: sandbox.stub().returns({
                    getCustomerNo: sandbox.stub().returns('CUST-456')
                })
            };
            mockBasket.getCustomer.returns(registeredCustomer);

            var payload = JPMCCheckoutSessionHelper.buildIntentPayload(mockBasket);
            assert.isObject(payload.checkoutOptions.consumerProfileOptions);
            assert.isTrue(payload.checkoutOptions.consumerProfileOptions.isSaveConsumerProfile);
        });

        it('should NOT include consumerProfileOptions for guest customers', function () {
            var payload = JPMCCheckoutSessionHelper.buildIntentPayload(mockBasket);
            assert.isUndefined(payload.checkoutOptions.consumerProfileOptions);
        });

        it('should include 3DS authentication request when enabled', function () {
            mockJPMCConfig.is3DSEnabled.returns(true);
            
            // Mock order search results for cardholder history
            var mockSearchResult = {
                getCount: sandbox.stub().returns(2),
                next: sandbox.stub().returns({
                    getCreationDate: sandbox.stub().returns(new Date('2025-01-01'))
                }),
                close: sandbox.stub()
            };
            mockOrderMgr.searchOrders.returns(mockSearchResult);

            var registeredCustomer = {
                isAnonymous: sandbox.stub().returns(false),
                getProfile: sandbox.stub().returns({
                    getCustomerNo: sandbox.stub().returns('CUST-456'),
                    getCreationDate: sandbox.stub().returns(new Date('2024-01-01'))
                })
            };
            mockBasket.getCustomer.returns(registeredCustomer);

            var payload = JPMCCheckoutSessionHelper.buildIntentPayload(mockBasket);
            assert.isObject(payload.checkoutOptions.paymentCardAuthenticationRequest);
            assert.isObject(payload.checkoutOptions.paymentCardAuthenticationRequest.cardholderAccountHistory);
            assert.isObject(payload.checkoutOptions.paymentCardAuthenticationRequest.purchaseInfo);
        });
    });

    // ─── createSession ──────────────────────────────────────────────────────

    describe('createSession', function () {
        it('should return error when basket is null', function () {
            var result = JPMCCheckoutSessionHelper.createSession(null);
            assert.isFalse(result.success);
            assert.equal(result.error, 'Order is required');
            assert.isNull(result.checkoutSessionToken);
        });

        it('should successfully create checkout session', function () {
            var result = JPMCCheckoutSessionHelper.createSession(mockBasket);
            assert.isTrue(result.success);
            assert.equal(result.checkoutSessionToken, 'token-123456');
            assert.isObject(result.data);
            assert.equal(result.data.sessionId, 'session-abc');
            assert.isNull(result.error);
        });

        it('should use resolvedConfig from options when provided', function () {
            var customConfig = {
                merchantId: 'CUSTOM_MERCHANT',
                saveConsumerProfile: false
            };
            JPMCCheckoutSessionHelper.createSession(mockBasket, {
                resolvedConfig: customConfig
            });
            assert.isTrue(mockJPMCCheckoutIntentService.createCheckoutSession.called);
        });

        it('should return error when service call fails', function () {
            mockJPMCCheckoutIntentService.createCheckoutSession.returns({
                success: false,
                error: 'Service unavailable'
            });

            var result = JPMCCheckoutSessionHelper.createSession(mockBasket);
            assert.isFalse(result.success);
            assert.equal(result.error, 'Service unavailable');
            assert.isNull(result.checkoutSessionToken);
        });

        it('should catch and return exceptions', function () {
            mockJPMCCheckoutIntentService.createCheckoutSession.throws(new Error('Network error'));

            var result = JPMCCheckoutSessionHelper.createSession(mockBasket);
            assert.isFalse(result.success);
            assert.include(result.error, 'Network error');
            assert.isNull(result.checkoutSessionToken);
        });
    });

    // ─── getOrUpdateJpmcIntent (EU DROP-IN FLOW) ───────────────────────────

    describe('getOrUpdateJpmcIntent - EU Drop-in Order Number Reservation', function () {
        it('should return error when basket is null', function () {
            var result = JPMCCheckoutSessionHelper.getOrUpdateJpmcIntent(null);
            assert.isFalse(result.success);
            assert.equal(result.error, 'Basket is required');
        });

        it('should reserve new order number when basket has no jpmcReservedOrderNo', function () {
            var result = JPMCCheckoutSessionHelper.getOrUpdateJpmcIntent(mockBasket);
            
            assert.isTrue(result.success);
            assert.isTrue(mockOrderMgr.createOrderSequenceNo.called);
            assert.equal(mockBasket.custom.jpmcReservedOrderNo, '00001234');
            assert.equal(mockBasket.custom.jpmcCheckoutIntentOrderNumber, '00001234');
            assert.equal(mockBasket.custom.jpmcLastEtag, 'etag-abc123');
            assert.isString(result.checkoutSessionToken);
            assert.equal(result.merchantOrderNumber, '00001234');
        });

        it('should reuse existing order number when basket already has jpmcReservedOrderNo', function () {
            mockBasket.custom.jpmcReservedOrderNo = '00005678';
            mockBasket.custom.jpmcLastEtag = 'etag-abc123';
            mockBasket.custom.jpmcCheckoutIntentOrderNumber = '00005678';

            var result = JPMCCheckoutSessionHelper.getOrUpdateJpmcIntent(mockBasket, {
                cachedSessionToken: 'cached-token-xyz'
            });
            
            assert.isTrue(result.success);
            assert.isFalse(mockOrderMgr.createOrderSequenceNo.called);
            assert.equal(mockBasket.custom.jpmcReservedOrderNo, '00005678');
            assert.isTrue(result.reused);
            assert.equal(result.checkoutSessionToken, 'cached-token-xyz');
            assert.equal(result.merchantOrderNumber, '00005678');
        });

        it('should detect basket ETag change and regenerate token with epoch suffix', function () {
            mockBasket.custom.jpmcReservedOrderNo = '00005678';
            mockBasket.custom.jpmcLastEtag = 'etag-OLD';
            mockBasket.custom.jpmcCheckoutIntentOrderNumber = '00005678';
            mockBasket.getEtag.returns('etag-NEW');

            var result = JPMCCheckoutSessionHelper.getOrUpdateJpmcIntent(mockBasket, {
                cachedSessionToken: 'cached-token-xyz'
            });
            
            assert.isTrue(result.success);
            assert.isFalse(result.reused);
            assert.isTrue(result.etagChanged);
            assert.notEqual(result.checkoutSessionToken, 'cached-token-xyz');
            assert.include(result.merchantOrderNumber, '00005678-');
            assert.match(result.merchantOrderNumber, /^00005678-[a-z0-9]+$/);
        });

        it('should update basket with new ETag after creating intent', function () {
            mockBasket.getEtag.returns('etag-NEW-VALUE');

            var result = JPMCCheckoutSessionHelper.getOrUpdateJpmcIntent(mockBasket);
            
            assert.isTrue(result.success);
            assert.equal(mockBasket.custom.jpmcLastEtag, 'etag-NEW-VALUE');
            assert.isString(mockBasket.custom.jpmcCheckoutIntentOrderNumber);
        });

        it('should NOT reuse token when previousEtag is missing', function () {
            mockBasket.custom.jpmcReservedOrderNo = '00005678';
            mockBasket.custom.jpmcLastEtag = null; // No previous ETag
            mockBasket.custom.jpmcCheckoutIntentOrderNumber = '00005678';

            var result = JPMCCheckoutSessionHelper.getOrUpdateJpmcIntent(mockBasket, {
                cachedSessionToken: 'cached-token-xyz'
            });
            
            assert.isTrue(result.success);
            // etagChanged is false when previousEtag is missing (logic: !!previousEtag && !!currentEtag && currentEtag !== previousEtag)
            assert.isFalse(result.etagChanged);
            // But token won't be reused because previousEtag condition fails in reuse check
            assert.isFalse(result.reused);
            assert.isTrue(mockJPMCCheckoutIntentService.createCheckoutSession.called);
        });

        it('should NOT reuse token when cached token is missing', function () {
            mockBasket.custom.jpmcReservedOrderNo = '00005678';
            mockBasket.custom.jpmcLastEtag = 'etag-abc123';
            mockBasket.custom.jpmcCheckoutIntentOrderNumber = '00005678';

            var result = JPMCCheckoutSessionHelper.getOrUpdateJpmcIntent(mockBasket);
            
            // Should create new session since cachedSessionToken is missing
            assert.isTrue(mockJPMCCheckoutIntentService.createCheckoutSession.called);
            assert.isTrue(result.success);
            // New session created, so reused should be false
            assert.isFalse(result.reused);
        });

        it('should return error when order sequence generation fails', function () {
            mockOrderMgr.createOrderSequenceNo.throws(new Error('Sequence generation failed'));

            var result = JPMCCheckoutSessionHelper.getOrUpdateJpmcIntent(mockBasket);
            
            assert.isFalse(result.success);
            assert.include(result.error, 'Sequence generation failed');
        });

        it('should return error when createSession fails', function () {
            mockJPMCCheckoutIntentService.createCheckoutSession.returns({
                success: false,
                error: 'Payment service error'
            });

            var result = JPMCCheckoutSessionHelper.getOrUpdateJpmcIntent(mockBasket);
            
            assert.isFalse(result.success);
            assert.equal(result.error, 'Payment service error');
        });

        it('should handle missing ETag gracefully', function () {
            mockBasket.getEtag.returns('');

            var result = JPMCCheckoutSessionHelper.getOrUpdateJpmcIntent(mockBasket);
            
            assert.isTrue(result.success);
            assert.equal(result.etag, '');
        });

        it('should use Transaction.wrap when reserving order number', function () {
            JPMCCheckoutSessionHelper.getOrUpdateJpmcIntent(mockBasket);
            
            assert.isTrue(mockTransaction.wrap.called);
            assert.isAtLeast(mockTransaction.wrap.callCount, 1);
        });
    });
});
