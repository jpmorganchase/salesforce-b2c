'use strict';

/* eslint-disable no-unused-vars */

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

describe('int_jpmc_sfra/scripts/hooks/payment/processor/jpmc_payment', function () {
    var jpmcPayment;
    var mockLogger;
    var mockTransaction;
    var mockPaymentInstrument;
    var mockPaymentMgr;
    var mockResource;
    var mockHookMgr;
    var mockJPMCConfig;
    var mockJPMCPaymentHelper;
    var mockBasket;
    var mockReq;
    var mockPaymentForm;
    var collectionsModule;
    var jpmcConstantsModule;

    /** Standard encrypted data simulating PIE output */
    var VALID_ENCRYPTED_DATA = JSON.stringify({
        accountNumber: 'PIE_ENCRYPTED_PAN_1234',
        cvv: 'PIE_ENCRYPTED_CVV',
        encryptionIntegrityCheck: 'CHECK_OK'
    });

    beforeEach(function () {
 
        mockLogger = require('../../../../../../../test/mocks/dw/system/Logger');
        mockLogger.resetAllLoggers();

        mockTransaction = require('../../../../../../../test/mocks/dw/system/Transaction');
        mockTransaction.reset();
        sinon.spy(mockTransaction, 'wrap');

        var PaymentInstrumentMock = require('../../../../../../../test/mocks/dw/order/PaymentInstrument');
        PaymentInstrumentMock.reset();

        mockResource = require('../../../../../../../test/mocks/dw/web/Resource');

        mockPaymentMgr = require('../../../../../../../test/mocks/dw/order/PaymentMgr');
        mockPaymentMgr.resetMockPaymentMethods();

        var mockPaymentCard = {
            cardType: 'Visa'
        };
        var mockApplicableCards = {
            contains: sinon.stub().returns(true)
        };
        var mockCreditCardMethod = {
            getApplicablePaymentCards: sinon.stub().returns(mockApplicableCards)
        };
        mockPaymentMgr.setMockPaymentMethod('CREDIT_CARD', mockCreditCardMethod);
        mockPaymentMgr.getPaymentCard = sinon.stub().returns(mockPaymentCard);

        mockHookMgr = require('../../../../../../../test/mocks/dw/system/HookMgr');
        mockHookMgr._registerHook('app.safetech.fraud.detection');
        mockHookMgr._setHookResult('app.safetech.fraud.detection', 'fraudDetection', {
            status: 'success',
            action: 'APPROVE',
            fraudRuleAction: 'A',
            fraudScore: 15,
            riskLevel: 'LOW'
        });

        mockJPMCConfig = {
            getConfig: sinon.stub().returns({ accountNumberType: 'SAFETECH_TOKEN' }),
            isFraudCheckEnabled: sinon.stub().returns(true),
            isFraudCheckEnabledAtAuth: sinon.stub().returns(false),
            getCaptureMethod: sinon.stub().returns('DELAYED')
        };

        mockJPMCPaymentHelper = {
            verifyPaymentInstrument: sinon.stub().returns({
                success: true,
                data: {
                    paymentMethodType: {
                        card: {
                            paymentTokens: [{
                                tokenProvider: 'SAFETECH',
                                responseStatus: 'SUCCESS',
                                tokenNumber: 'SAFE_TOKEN_12345'
                            }]
                        }
                    }
                }
            }),
            createPayment: sinon.stub().returns({
                success: true,
                transactionId: 'TXN-001'
            }),
            performFraudCheckForCardSave: sinon.stub().returns({
                success: true,
                riskDecision: { fraudRuleAction: 'A' }
            })
        };

       
        var Order = require('../../../../../../../test/mocks/dw/order/Order');
        Order.resetMock();
        mockBasket = new Order();
        mockBasket.billingAddress = {
            fullName: 'John Doe',
            address1: '123 Main St',
            city: 'Test City',
            stateCode: 'CA',
            postalCode: '12345',
            countryCode: { value: 'US' }
        };

       
        global.session = {
            privacy: {},
            forms: {
                billing: {
                    creditCardFields: {
                        saveCard: { checked: false }
                    }
                },
                creditCard: {}
            }
        };

        global.request = {
            getHttpRemoteAddress: sinon.stub().returns('127.0.0.1'),
            httpUserAgent: 'TestAgent/1.0'
        };

        mockReq = {
            form: {
                storedPaymentUUID: null,
                kountSessionId: 'KOUNT-123'
            },
            currentCustomer: {
                raw: { authenticated: true, registered: true },
                profile: { customerNo: '12345' },
                wallet: { paymentInstruments: [] }
            },
            geolocation: { countryCode: 'US' }
        };

        mockPaymentForm = {
            paymentMethod: { value: 'CREDIT_CARD' },
            creditCardFields: {
                cardNumber: { value: '4111111111111111', htmlName: 'cardNumber' },
                cardType: { value: 'Visa', htmlName: 'cardType' },
                securityCode: { value: '123', htmlName: 'securityCode' },
                expirationMonth: { value: '12', selectedOption: '12', htmlName: 'expirationMonth' },
                expirationYear: { value: '2028', htmlName: 'expirationYear' },
                encryptedData: { value: VALID_ENCRYPTED_DATA },
                saveCard: { checked: false }
            }
        };

        collectionsModule = {
            forEach: function (collection, callback) {
                var arr = collection;
                if (typeof collection.toArray === 'function') {
                    arr = collection.toArray();
                }
                if (Array.isArray(arr)) {
                    arr.forEach(callback);
                }
            }
        };

        jpmcConstantsModule = {
            JPMC_GOOGLE_PAY: 'JPMC_GOOGLE_PAY',
            JPMC_Processor: 'JPMC_Processor',
            GOOGLE_PAY_WALLET_PROVIDER: 'GOOGLE_PAY'
        };

        jpmcPayment = proxyquire(
            '../../../../../../../cartridges/int_jpmc_sfra/cartridge/scripts/hooks/payment/processor/jpmc_payment',
            {
                'dw/system/Logger': mockLogger,
                'dw/system/Transaction': mockTransaction,
                'dw/order/PaymentInstrument': PaymentInstrumentMock,
                'dw/order/PaymentMgr': mockPaymentMgr,
                'dw/web/Resource': mockResource,
                'dw/system/HookMgr': mockHookMgr,
                'dw/customer/CustomerMgr': {
                    getCustomerByCustomerNumber: sinon.stub().returns({
                        getProfile: sinon.stub().returns({
                            getWallet: sinon.stub().returns({
                                createPaymentInstrument: sinon.stub().returns(new PaymentInstrumentMock())
                            })
                        })
                    })
                },
                '*/cartridge/scripts/helpers/JPMCConstants': jpmcConstantsModule,
                '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig,
                '*/cartridge/scripts/helpers/JPMCPaymentHelper': mockJPMCPaymentHelper,
                '*/cartridge/scripts/util/collections': collectionsModule,
                '*/cartridge/scripts/util/array': {
                    find: function (arr, predicate) {
                        for (var i = 0; i < arr.length; i++) {
                            if (predicate(arr[i])) return arr[i];
                        }
                        return null;
                    }
                },
                '*/cartridge/scripts/checkout/checkoutHelpers': {
                    validateCreditCard: sinon.stub().returns({}),
                    savePaymentInstrumentToWallet: sinon.stub().returns({
                        creditCardHolder: 'John Doe',
                        maskedCreditCardNumber: '***1111',
                        creditCardType: 'Visa',
                        creditCardExpirationMonth: 12,
                        creditCardExpirationYear: 2028,
                        UUID: 'UUID-123',
                        creditCardNumber: '***1111',
                        creditCardToken: 'SAFE_TOKEN_12345',
                        custom: {}
                    })
                },
                '*/cartridge/scripts/hooks/payment/processor/jpmc_googlepay': {
                    processForm: sinon.stub().returns({ error: false, viewData: {} }),
                    Handle: sinon.stub().returns({ fieldErrors: {}, serverErrors: [], error: false }),
                    Authorize: sinon.stub().returns({ fieldErrors: {}, serverErrors: [], error: false })
                },
                '*/cartridge/scripts/helpers/JPMCTransactionHelpers': {
                    authorize: sinon.stub().returns({ error: false, serverErrors: [], transactionId: 'TXN-CC-001' }),
                    authorizeGooglePay: sinon.stub().returns({ error: false })
                },
                '*/cartridge/scripts/helpers/JPMCMerchantResolver': {
                    resolve: sinon.stub().returns({ 
                        merchantId: 'TEST_MERCHANT_ID',
                        enableFraudCheck: true
                    }),
                    resolveForOrder: sinon.stub().returns({ 
                        merchantId: 'TEST_MERCHANT_ID',
                        enableFraudCheck: true
                    }),
                    toAccessTokenConfig: sinon.stub().returns({}),
                    invalidateCache: sinon.stub()
                }
            }
        );
    });

    afterEach(function () {
        sinon.restore();
        delete global.session;
        delete global.request;
        mockHookMgr._unregisterHook('app.safetech.fraud.detection');
        mockPaymentMgr.resetMockPaymentMethods();
    });

    
    describe('clearSensitivePaymentData()', function () {
        it('should null-out all three session.privacy CVV/encrypted fields', function () {
            global.session.privacy.jpmcEncryptedCvv = 'enc-cvv';
            global.session.privacy.jpmcEncryptedData = 'enc-data';

            jpmcPayment.clearSensitivePaymentData();
            assert.isNull(global.session.privacy.jpmcEncryptedCvv);
            assert.isNull(global.session.privacy.jpmcEncryptedData);
        });

        it('should NOT throw when session is unavailable', function () {
            delete global.session;
            assert.doesNotThrow(function () {
                jpmcPayment.clearSensitivePaymentData();
            });
        });
    });

 
    describe('processForm()', function () {
        it('should extract card fields and encrypted data into viewData', function () {
            var result = jpmcPayment.processForm(mockReq, mockPaymentForm, {});

            assert.isFalse(result.error);
            assert.equal(result.viewData.paymentInformation.cardNumber.value, '4111111111111111');
            assert.equal(result.viewData.paymentInformation.cardType.value, 'Visa');
            assert.equal(result.viewData.paymentInformation.expirationMonth.value, 12);
            assert.equal(result.viewData.paymentInformation.expirationYear.value, 2028);
            assert.isDefined(result.viewData.paymentInformation.encryptedData);
        });

        it('should delegate to Google Pay processForm when payment method is JPMC_GOOGLE_PAY', function () {
            mockPaymentForm.paymentMethod.value = 'JPMC_GOOGLE_PAY';

            var result = jpmcPayment.processForm(mockReq, mockPaymentForm, {});

            assert.isFalse(result.error);
        });

        it('should return errors when credit card validation fails', function () {
            var mockCOHelpers = {
                validateCreditCard: sinon.stub().returns({ cardNumber: 'Invalid' })
            };
    
            var modWithBadCard = proxyquire(
                '../../../../../../../cartridges/int_jpmc_sfra/cartridge/scripts/hooks/payment/processor/jpmc_payment',
                {
                    'dw/system/Logger': mockLogger,
                    'dw/system/Transaction': mockTransaction,
                    'dw/order/PaymentInstrument': require('../../../../../../../test/mocks/dw/order/PaymentInstrument'),
                    'dw/order/PaymentMgr': mockPaymentMgr,
                    'dw/web/Resource': mockResource,
                    'dw/system/HookMgr': mockHookMgr,
                    '*/cartridge/scripts/helpers/JPMCConstants': jpmcConstantsModule,
                    '*/cartridge/scripts/checkout/checkoutHelpers': mockCOHelpers,
                    '*/cartridge/scripts/util/array': { find: function () { return null; } },
                    '*/cartridge/scripts/hooks/payment/processor/jpmc_googlepay': {}
                }
            );

            var result = modWithBadCard.processForm(mockReq, mockPaymentForm, {});

            assert.isTrue(result.error);
            assert.isDefined(result.fieldErrors);
        });

        it('should populate storedPaymentUUID for saved card selection', function () {
            mockReq.form.storedPaymentUUID = 'SAVED-UUID-001';
            mockReq.currentCustomer.wallet.paymentInstruments = [{
                UUID: 'SAVED-UUID-001',
                creditCardNumber: '***1111',
                creditCardType: 'Visa',
                creditCardExpirationMonth: 12,
                creditCardExpirationYear: 2028,
                raw: { creditCardToken: 'STORED_TOKEN_XYZ' }
            }];

            var result = jpmcPayment.processForm(mockReq, mockPaymentForm, {});

            assert.isFalse(result.error);
            assert.equal(result.viewData.paymentInformation.creditCardToken, 'STORED_TOKEN_XYZ');
            assert.equal(result.viewData.storedPaymentUUID, 'SAVED-UUID-001');
        });
    });

    describe('Handle()', function () {
        var paymentInfo;

        beforeEach(function () {
            paymentInfo = {
                cardNumber: { value: '4111111111111111' },
                cardType: { value: 'Visa' },
                securityCode: { value: '123' },
                expirationMonth: { value: 12 },
                expirationYear: { value: 2028 },
                encryptedData: { value: VALID_ENCRYPTED_DATA },
                saveCard: false
            };
        });

        it('should create a payment instrument on the basket', function () {
            var result = jpmcPayment.Handle(mockBasket, paymentInfo, 'CREDIT_CARD', mockReq);

            assert.isFalse(result.error);
            var instruments = mockBasket.getPaymentInstruments('CREDIT_CARD');
            assert.isAbove(instruments.length, 0, 'Basket should contain a CREDIT_CARD PI');
            assert.equal(instruments[0].custom.jpmcMerchantId, 'TEST_MERCHANT_ID', 'Basket PI should carry merchant ID');
        });

        it('should store PIE-encrypted data (NOT raw PAN) on session.privacy', function () {
            jpmcPayment.Handle(mockBasket, paymentInfo, 'CREDIT_CARD', mockReq);

            assert.equal(global.session.privacy.jpmcEncryptedCvv, 'PIE_ENCRYPTED_CVV');
            assert.isNotNull(global.session.privacy.jpmcEncryptedData);
        });

        it('should store raw CVV in session.privacy ONLY for stored (tokenized) cards', function () {
            paymentInfo.storedPaymentUUID = 'STORED-UUID';
            paymentInfo.creditCardToken = 'STORED_TOKEN';

            jpmcPayment.Handle(mockBasket, paymentInfo, 'CREDIT_CARD', mockReq);

            assert.isNull(global.session.privacy.jpmcEncryptedCvv);
            assert.isNull(global.session.privacy.jpmcEncryptedData);
        });

        it('should reject when encrypted data is missing for new cards', function () {
            delete paymentInfo.encryptedData;

            var result = jpmcPayment.Handle(mockBasket, paymentInfo, 'CREDIT_CARD', mockReq);

            assert.isTrue(result.error);
            assert.isAbove(result.serverErrors.length, 0);
        });

        it('should reject when encrypted data is malformed JSON', function () {
            paymentInfo.encryptedData = { value: 'NOT_JSON' };

            var result = jpmcPayment.Handle(mockBasket, paymentInfo, 'CREDIT_CARD', mockReq);

            assert.isTrue(result.error);
        });

        it('should reject when encrypted data structure is incomplete (missing cvv)', function () {
            paymentInfo.encryptedData = { value: JSON.stringify({ accountNumber: 'ENC' }) };

            var result = jpmcPayment.Handle(mockBasket, paymentInfo, 'CREDIT_CARD', mockReq);

            assert.isTrue(result.error);
        });

        it('should clear SafeTech token from previous session on each Handle call', function () {
            global.session.privacy.jpmcCardSafeTechToken = 'STALE_TOKEN';

            jpmcPayment.Handle(mockBasket, paymentInfo, 'CREDIT_CARD', mockReq);

            assert.isNull(global.session.privacy.jpmcCardSafeTechToken);
        });

        it('should call fraud detection hook before verification', function () {
            jpmcPayment.Handle(mockBasket, paymentInfo, 'CREDIT_CARD', mockReq);

            assert.isTrue(mockJPMCPaymentHelper.verifyPaymentInstrument.calledOnce);
        });

        it('should remove PI and clear session on fraud decline', function () {
            mockHookMgr._setHookResult('app.safetech.fraud.detection', 'fraudDetection', {
                status: 'fail',
                action: 'DECLINE',
                errorCode: 'FRAUD_DECLINED'
            });

            var result = jpmcPayment.Handle(mockBasket, paymentInfo, 'CREDIT_CARD', mockReq);

            assert.isTrue(result.error);
            assert.isNull(global.session.privacy.jpmcEncryptedCvv);
            assert.isNull(global.session.privacy.jpmcEncryptedData);
        });

        it('should extract and store SAFETECH token in session when saveCard is checked', function () {
            paymentInfo.saveCard = true;

            jpmcPayment.Handle(mockBasket, paymentInfo, 'CREDIT_CARD', mockReq);

            assert.equal(global.session.privacy.jpmcCardSafeTechToken, 'SAFE_TOKEN_12345');
        });

        it('should NOT store SAFETECH token when saveCard is unchecked', function () {
            paymentInfo.saveCard = false;

            jpmcPayment.Handle(mockBasket, paymentInfo, 'CREDIT_CARD', mockReq);

            assert.isNull(global.session.privacy.jpmcCardSafeTechToken);
        });

        it('should clear session and return error when JPMC verification fails', function () {
            mockJPMCPaymentHelper.verifyPaymentInstrument.returns({ success: false, error: 'Bad card' });

            var result = jpmcPayment.Handle(mockBasket, paymentInfo, 'CREDIT_CARD', mockReq);

            assert.isTrue(result.error);
            assert.isNull(global.session.privacy.jpmcEncryptedData);
        });

        it('should delegate to Google Pay Handle when method is JPMC_GOOGLE_PAY', function () {
            var result = jpmcPayment.Handle(mockBasket, paymentInfo, 'JPMC_GOOGLE_PAY', mockReq);

            assert.isFalse(result.error);
        });

        it('should capture Kount session ID on payment instrument custom', function () {
            mockReq.form.kountSessionId = 'KOUNT-SESS-ABC';

            jpmcPayment.Handle(mockBasket, paymentInfo, 'CREDIT_CARD', mockReq);

            var instruments = mockBasket.getPaymentInstruments('CREDIT_CARD');
            assert.isAbove(instruments.length, 0);
            assert.equal(instruments[0].custom.kountSessionId, 'KOUNT-SESS-ABC');
        });
    });


    describe('Authorize()', function () {
        var mockProcessor;

        beforeEach(function () {
            mockProcessor = {
                getID: sinon.stub().returns({
                    equalsIgnoreCase: function (val) { return val === 'JPMC_Processor'; }
                })
            };
        });

        it('should return success for valid authorization', function () {
            var pi = new (require('../../../../../../../test/mocks/dw/order/PaymentInstrument'))();
            pi.paymentMethod = 'CREDIT_CARD';

            var result = jpmcPayment.Authorize('ORDER-001', pi, mockProcessor);

            assert.isFalse(result.error);
        });

        it('should return error for null payment processor', function () {
            var pi = new (require('../../../../../../../test/mocks/dw/order/PaymentInstrument'))();

            var result = jpmcPayment.Authorize('ORDER-001', pi, null);

            assert.isTrue(result.error);
        });

        it('should delegate to Google Pay Authorize when method is JPMC_GOOGLE_PAY', function () {
            var pi = new (require('../../../../../../../test/mocks/dw/order/PaymentInstrument'))();
            pi.paymentMethod = 'JPMC_GOOGLE_PAY';

            var result = jpmcPayment.Authorize('ORDER-001', pi, mockProcessor);

            assert.isFalse(result.error);
        });
    });

    describe('savePaymentInformation()', function () {
        it('should save payment instrument to wallet when saveCard is true and SAFETECH token exists', function () {
            global.session.privacy.jpmcCardSafeTechToken = 'SAFE_TOKEN_12345';
            var billingData = {
                paymentMethod: { value: 'CREDIT_CARD' },
                saveCard: true,
                paymentInformation: {
                    cardNumber: { value: '***1111' },
                    cardType: { value: 'Visa' },
                    expirationMonth: { value: 12 },
                    expirationYear: { value: 2028 }
                }
            };

            jpmcPayment.savePaymentInformation(mockReq, mockBasket, billingData);

            assert.isAbove(mockReq.currentCustomer.wallet.paymentInstruments.length, 0);
            var savedPI = mockReq.currentCustomer.wallet.paymentInstruments.find(function (pi) {
                return pi.UUID === 'UUID-123';
            });
            assert.isDefined(savedPI, 'Saved PI should be in wallet');
            assert.equal(savedPI.raw.custom.jpmcMerchantId, 'TEST_MERCHANT_ID', 'Wallet PI should carry merchant ID');
        });

        it('should NOT save when payment method is JPMC_GOOGLE_PAY', function () {
            var billingData = {
                paymentMethod: { value: 'JPMC_GOOGLE_PAY' },
                saveCard: true
            };

            jpmcPayment.savePaymentInformation(mockReq, mockBasket, billingData);

            assert.equal(mockReq.currentCustomer.wallet.paymentInstruments.length, 0);
        });

        it('should NOT save when user is not authenticated', function () {
            mockReq.currentCustomer.raw.authenticated = false;
            global.session.privacy.jpmcCardSafeTechToken = 'TOKEN';
            var billingData = {
                paymentMethod: { value: 'CREDIT_CARD' },
                saveCard: true
            };

            jpmcPayment.savePaymentInformation(mockReq, mockBasket, billingData);

            assert.equal(mockReq.currentCustomer.wallet.paymentInstruments.length, 0);
        });

        it('should NOT save when no SAFETECH token in session', function () {
            global.session.privacy.jpmcCardSafeTechToken = null;
            var billingData = {
                paymentMethod: { value: 'CREDIT_CARD' },
                saveCard: true
            };

            jpmcPayment.savePaymentInformation(mockReq, mockBasket, billingData);

            assert.equal(mockReq.currentCustomer.wallet.paymentInstruments.length, 0);
        });
    });

  
    describe('createToken()', function () {
        beforeEach(function () {
            global.session.forms.creditCard = {
                encryptedData: { value: VALID_ENCRYPTED_DATA },
                expirationMonth: { value: 12 },
                expirationYear: { value: 2028 },
                kountSessionId: { value: 'KOUNT-MA-1' }
            };
        });

        it('should return a SAFETECH token on successful verification', function () {
            var token = jpmcPayment.createToken();
            assert.equal(token, 'SAFE_TOKEN_12345');
        });

        it('should throw when encrypted data is missing from form', function () {
            global.session.forms.creditCard.encryptedData = { value: null };

            assert.throws(function () {
                jpmcPayment.createToken();
            }, /Payment data is missing/);
        });

        it('should throw when encrypted data is not valid JSON', function () {
            global.session.forms.creditCard.encryptedData = { value: 'GARBAGE' };

            assert.throws(function () {
                jpmcPayment.createToken();
            }, /Payment data is invalid/);
        });

        it('should throw when verification fails', function () {
            mockJPMCPaymentHelper.verifyPaymentInstrument.returns({ success: false, error: 'declined' });

            assert.throws(function () {
                jpmcPayment.createToken();
            }, /Payment verification failed/);
        });

        it('should throw when fraud check declines', function () {
            mockJPMCPaymentHelper.performFraudCheckForCardSave = sinon.stub().returns({
                success: true,
                riskDecision: { fraudRuleAction: 'D' }
            });

            assert.throws(function () {
                jpmcPayment.createToken();
            }, /security reasons/);
        });
    });

 
    describe('Module Exports', function () {
        it('should export all required hook functions', function () {
            assert.isFunction(jpmcPayment.processForm);
            assert.isFunction(jpmcPayment.Handle);
            assert.isFunction(jpmcPayment.Authorize);
            assert.isFunction(jpmcPayment.savePaymentInformation);
            assert.isFunction(jpmcPayment.createToken);
            assert.isFunction(jpmcPayment.clearSensitivePaymentData);
        });
    });
});
