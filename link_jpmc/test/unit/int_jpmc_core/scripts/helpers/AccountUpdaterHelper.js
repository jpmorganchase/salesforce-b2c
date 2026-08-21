'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();

var PIClass = require('../../../../../test/mocks/dw/order/PaymentInstrument');
var Wallet = require('../../../../../test/mocks/dw/customer/Wallet');

/**
 * Creates a pre-populated payment instrument representing a saved card.
 * @param {Object} [overrides] - optional field overrides
 * @returns {Object} PaymentInstrument mock
 */
function makeOldPI(overrides) {
    var pi = new PIClass();
    pi.setCreditCardHolder('Test Cardholder');
    pi.setCreditCardNumber('XXXXXXXXXXXX0000');
    pi.setCreditCardType('MC');
    pi.setCreditCardToken((overrides && overrides.token) ? overrides.token : 'test-stored-token-aaa');
    pi.setCreditCardExpirationMonth((overrides && overrides.month) ? overrides.month : 9);
    pi.setCreditCardExpirationYear((overrides && overrides.year) ? overrides.year : 2027);
    return pi;
}



describe('accountUpdaterHelper', function () {
    var accountUpdaterHelper;
    var LoggerMock;
    var TransactionMock;

    beforeEach(function () {
        LoggerMock = require('../../../../../test/mocks/dw/system/Logger');
        TransactionMock = require('../../../../../test/mocks/dw/system/Transaction');

        LoggerMock.resetAllLoggers();
        TransactionMock.reset();

        accountUpdaterHelper = proxyquire(
            '../../../../../cartridges/int_jpmc_core/cartridge/scripts/helpers/AccountUpdaterHelper',
            {
                'dw/system/Logger': LoggerMock,
                'dw/system/Transaction': TransactionMock,
                'dw/order/PaymentInstrument': PIClass
            }
        );
    });

    // ─── handleRTAUResponse ──────────────────────────────────────────────────

    describe('handleRTAUResponse', function () {

        // ─── No-op / guard cases ─────────────────────────────────────────────

        it('should return not updated when no accountUpdater block', function () {
            var wallet = new Wallet();
            var result = accountUpdaterHelper.handleRTAUResponse(makeOldPI(), { paymentMethodType: { card: {} } }, wallet);
            assert.isFalse(result.updated);
            assert.isNull(result.action);
            assert.equal(wallet._instruments.length, 0);
        });

        it('should return not updated for MATCH_NO_UPDATE', function () {
            var wallet = new Wallet();
            var result = accountUpdaterHelper.handleRTAUResponse(makeOldPI(),
                { accountUpdater: { accountUpdaterResponse: 'MATCH_NO_UPDATE' } }, wallet);
            assert.isFalse(result.updated);
            assert.equal(result.action, 'MATCH_NO_UPDATE');
            assert.equal(wallet._instruments.length, 0);
        });

        it('should return not updated for NO_MATCH_PARTICIPATING_BIN', function () {
            var wallet = new Wallet();
            assert.isFalse(accountUpdaterHelper.handleRTAUResponse(makeOldPI(),
                { accountUpdater: { accountUpdaterResponse: 'NO_MATCH_PARTICIPATING_BIN' } }, wallet).updated);
            assert.equal(wallet._instruments.length, 0);
        });

        it('should return not updated for NO_MATCH_NON_PARTICIPATING_BIN', function () {
            var wallet = new Wallet();
            assert.isFalse(accountUpdaterHelper.handleRTAUResponse(makeOldPI(),
                { accountUpdater: { accountUpdaterResponse: 'NO_MATCH_NON_PARTICIPATING_BIN' } }, wallet).updated);
        });

        it('should return not updated for CONTACT_CARDHOLDER', function () {
            var wallet = new Wallet();
            var result = accountUpdaterHelper.handleRTAUResponse(makeOldPI(),
                { accountUpdater: { accountUpdaterResponse: 'CONTACT_CARDHOLDER' } }, wallet);
            assert.isFalse(result.updated);
            assert.equal(result.action, 'CONTACT_CARDHOLDER');
            assert.equal(wallet._instruments.length, 0);
        });

        it('should return not updated for CLOSED_ACCOUNT', function () {
            var wallet = new Wallet();
            var result = accountUpdaterHelper.handleRTAUResponse(makeOldPI(),
                { accountUpdater: { accountUpdaterResponse: 'CLOSED_ACCOUNT' } }, wallet);
            assert.isFalse(result.updated);
            assert.equal(result.action, 'CLOSED_ACCOUNT');
            assert.equal(wallet._instruments.length, 0);
        });

        it('should return not updated when paymentInstrument is null', function () {
            assert.isFalse(accountUpdaterHelper.handleRTAUResponse(null, {}, new Wallet()).updated);
        });

        it('should return not updated when responseData is null', function () {
            assert.isFalse(accountUpdaterHelper.handleRTAUResponse(makeOldPI(), null, new Wallet()).updated);
        });

        it('should return not updated when responseCode is null', function () {
            var result = accountUpdaterHelper.handleRTAUResponse(makeOldPI(), { accountUpdater: {} }, new Wallet());
            assert.isFalse(result.updated);
            assert.isNull(result.action);
        });

        it('should return not updated and warn when wallet is not provided', function () {
            var result = accountUpdaterHelper.handleRTAUResponse(makeOldPI(), {
                accountUpdater: { accountUpdaterResponse: 'NEW_EXPIRY', newAccountExpiry: { month: '6', year: '2029' } }
            });
            assert.isFalse(result.updated);
        });

        it('should return not updated when no token or expiry data exists in response', function () {
            // NEW_ACCOUNT_AND_EXPIRY with no paymentTokens, no accountNumber, no expiry
            var wallet = new Wallet();
            var result = accountUpdaterHelper.handleRTAUResponse(makeOldPI(),
                { accountUpdater: { accountUpdaterResponse: 'NEW_ACCOUNT_AND_EXPIRY' } }, wallet);
            assert.isFalse(result.updated);
            assert.equal(wallet._instruments.length, 0);
        });

        // ─── NEW_ACCOUNT_AND_EXPIRY ──────────────────────────────────────────

        it('NEW_ACCOUNT_AND_EXPIRY: replaces wallet PI with new token and expiry (accountNumber field)', function () {
            var oldPI = makeOldPI({ token: 'test-old-tok-111', month: 11, year: 2026 });
            var wallet = new Wallet();

            var result = accountUpdaterHelper.handleRTAUResponse(oldPI, {
                accountUpdater: {
                    accountUpdaterResponse: 'NEW_ACCOUNT_AND_EXPIRY',
                    accountNumber: 'test-new-tok-222',
                    newAccountExpiry: { month: '4', year: '2031' }
                }
            }, wallet);

            assert.isTrue(result.updated);
            assert.equal(wallet._instruments.length, 1);
            var newPI = wallet._instruments[0];
            assert.equal(newPI.getCreditCardToken(), 'test-new-tok-222');
            assert.equal(newPI.getCreditCardExpirationMonth(), 4);
            assert.equal(newPI.getCreditCardExpirationYear(), 2031);
            // Non-token fields copied from old PI
            assert.equal(newPI.getCreditCardHolder(), 'Test Cardholder');
            assert.equal(newPI.getCreditCardNumber(), 'XXXXXXXXXXXX0000');
            assert.equal(newPI.getCreditCardType(), 'MC');
        });

        it('NEW_ACCOUNT_AND_EXPIRY: finds new token from first SUCCESS paymentTokens entry', function () {
            var oldPI = makeOldPI({ token: 'test-old-tok-abc' });
            var wallet = new Wallet();

            var result = accountUpdaterHelper.handleRTAUResponse(oldPI, {
                accountUpdater: { accountUpdaterResponse: 'NEW_ACCOUNT_AND_EXPIRY', newAccountExpiry: { month: '7', year: '2032' } },
                paymentMethodType: {
                    card: {
                        paymentTokens: [
                            { tokenNumber: 'test-fail-tok-xyz', responseStatus: 'FAILURE' },
                            { tokenNumber: 'test-success-tok-xyz', responseStatus: 'SUCCESS' }
                        ]
                    }
                }
            }, wallet);

            assert.isTrue(result.updated);
            assert.equal(wallet._instruments.length, 1);
            assert.equal(wallet._instruments[0].getCreditCardToken(), 'test-success-tok-xyz');
            assert.equal(wallet._instruments[0].getCreditCardExpirationMonth(), 7);
        });

        it('NEW_ACCOUNT_AND_EXPIRY: preserves old token when all paymentTokens are non-SUCCESS', function () {
            var oldPI = makeOldPI({ token: 'test-orig-tok-bbb', month: 10, year: 2027 });
            var wallet = new Wallet();

            var result = accountUpdaterHelper.handleRTAUResponse(oldPI, {
                accountUpdater: { accountUpdaterResponse: 'NEW_ACCOUNT_AND_EXPIRY', newAccountExpiry: { month: '2', year: '2033' } },
                paymentMethodType: { card: { paymentTokens: [{ tokenNumber: 'test-fail-tok-aaa', responseStatus: 'FAILURE' }] } }
            }, wallet);

            assert.isTrue(result.updated);
            assert.equal(wallet._instruments.length, 1);
            var newPI = wallet._instruments[0];
            assert.equal(newPI.getCreditCardToken(), 'test-orig-tok-bbb');
            assert.equal(newPI.getCreditCardExpirationMonth(), 2);
            assert.equal(newPI.getCreditCardExpirationYear(), 2033);
        });

        // ─── NEW_ACCOUNT ─────────────────────────────────────────────────────

        it('NEW_ACCOUNT: replaces wallet PI with new token, carries forward old expiry (accountNumber field)', function () {
            var oldPI = makeOldPI({ token: 'test-old-tok-ccc', month: 8, year: 2028 });
            var wallet = new Wallet();

            var result = accountUpdaterHelper.handleRTAUResponse(oldPI, {
                accountUpdater: { accountUpdaterResponse: 'NEW_ACCOUNT', accountNumber: 'test-new-tok-ddd' }
            }, wallet);

            assert.isTrue(result.updated);
            assert.equal(wallet._instruments.length, 1);
            var newPI = wallet._instruments[0];
            assert.equal(newPI.getCreditCardToken(), 'test-new-tok-ddd');
            assert.equal(newPI.getCreditCardExpirationMonth(), 8);    // Carried from old PI
            assert.equal(newPI.getCreditCardExpirationYear(), 2028);  // Carried from old PI
            assert.equal(newPI.getCreditCardHolder(), 'Test Cardholder');
            assert.equal(newPI.getCreditCardType(), 'MC');
        });

        it('NEW_ACCOUNT: uses paymentTokens for token when accountNumber is absent', function () {
            var oldPI = makeOldPI({ token: 'test-old-tok-eee', month: 5, year: 2029 });
            var wallet = new Wallet();

            var result = accountUpdaterHelper.handleRTAUResponse(oldPI, {
                accountUpdater: { accountUpdaterResponse: 'NEW_ACCOUNT' },
                paymentMethodType: {
                    card: {
                        paymentTokens: [{ tokenNumber: 'test-tok-from-list-fff', responseStatus: 'SUCCESS' }]
                    }
                }
            }, wallet);

            assert.isTrue(result.updated);
            assert.equal(wallet._instruments[0].getCreditCardToken(), 'test-tok-from-list-fff');
            assert.equal(wallet._instruments[0].getCreditCardExpirationMonth(), 5);  // Carried
            assert.equal(wallet._instruments[0].getCreditCardExpirationYear(), 2029); // Carried
        });

        it('NEW_ACCOUNT: warns and skips when no token found in response', function () {
            var wallet = new Wallet();
            // No accountNumber and no paymentTokens — nothing to update
            var result = accountUpdaterHelper.handleRTAUResponse(makeOldPI(),
                { accountUpdater: { accountUpdaterResponse: 'NEW_ACCOUNT' } }, wallet);
            assert.isFalse(result.updated);
            assert.equal(result.action, 'NEW_ACCOUNT');
            assert.equal(wallet._instruments.length, 0);
        });

        // ─── NEW_EXPIRY ──────────────────────────────────────────────────────

        it('NEW_EXPIRY: replaces wallet PI with new expiry, token unchanged', function () {
            var oldPI = makeOldPI({ token: 'test-orig-tok-ggg', month: 3, year: 2026 });
            var wallet = new Wallet();

            var result = accountUpdaterHelper.handleRTAUResponse(oldPI, {
                accountUpdater: { accountUpdaterResponse: 'NEW_EXPIRY', newAccountExpiry: { month: '8', year: '2030' } }
            }, wallet);

            assert.isTrue(result.updated);
            assert.equal(wallet._instruments.length, 1);
            var newPI = wallet._instruments[0];
            assert.equal(newPI.getCreditCardToken(), 'test-orig-tok-ggg');   // Token unchanged
            assert.equal(newPI.getCreditCardExpirationMonth(), 8);
            assert.equal(newPI.getCreditCardExpirationYear(), 2030);
        });

        it('NEW_EXPIRY: does not apply token even if paymentTokens present', function () {
            var oldPI = makeOldPI({ token: 'test-existing-tok-hhh' });
            var wallet = new Wallet();

            var result = accountUpdaterHelper.handleRTAUResponse(oldPI, {
                accountUpdater: { accountUpdaterResponse: 'NEW_EXPIRY', newAccountExpiry: { month: '11', year: '2031' } },
                paymentMethodType: { card: { paymentTokens: [{ tokenNumber: 'test-ignored-tok-iii', responseStatus: 'SUCCESS' }] } }
            }, wallet);

            assert.isTrue(result.updated);
            assert.equal(wallet._instruments[0].getCreditCardToken(), 'test-existing-tok-hhh');  // Not replaced
        });

       

        it('should read accountUpdater from card block when top-level is absent', function () {
            var oldPI = makeOldPI();
            var wallet = new Wallet();

            var result = accountUpdaterHelper.handleRTAUResponse(oldPI, {
                paymentMethodType: {
                    card: {
                        accountUpdater: { accountUpdaterResponse: 'NEW_EXPIRY', newAccountExpiry: { month: '1', year: '2034' } }
                    }
                }
            }, wallet);

            assert.isTrue(result.updated);
            assert.equal(wallet._instruments[0].getCreditCardExpirationMonth(), 1);
            assert.equal(wallet._instruments[0].getCreditCardExpirationYear(), 2034);
        });

        // ─── Error handling ──────────────────────────────────────────────────

        it('should log error and return updated=false when Transaction.wrap throws', function () {
            TransactionMock.wrap = function () { throw new Error('RTAU Transaction failed'); };
            var result = accountUpdaterHelper.handleRTAUResponse(makeOldPI(), {
                accountUpdater: { accountUpdaterResponse: 'NEW_EXPIRY', newAccountExpiry: { month: '2', year: '2030' } }
            }, new Wallet());
            assert.isFalse(result.updated);
        });
    });

    // ─── processRTAUForOrder ─────────────────────────────────────────────────

    describe('processRTAUForOrder', function () {
        var Order = require('../../../../../test/mocks/dw/order/Order');

        /**
         * Builds a minimal order with one credit card PI (stored card) and a matching
         * wallet PI so processRTAUForOrder can locate and replace it.
         */
        function makeOrderWithWallet(token) {
            var order = new Order();

            var wallet = new Wallet();
            var walletPI = wallet.createPaymentInstrument(PIClass.METHOD_CREDIT_CARD);
            walletPI.setCreditCardHolder('Test Cardholder');
            walletPI.setCreditCardNumber('XXXXXXXXXXXX0000');
            walletPI.setCreditCardType('MC');
            walletPI.setCreditCardToken(token || 'test-stored-tok-zzz');
            walletPI.setCreditCardExpirationMonth(6);
            walletPI.setCreditCardExpirationYear(2027);

            var orderPI = order.createPaymentInstrument(PIClass.METHOD_CREDIT_CARD, 100);
            orderPI.setCreditCardToken(token || 'test-stored-tok-zzz');

            order.getCustomer = function () {
                return {
                    isRegistered: function () { return true; },
                    getProfile: function () { return { getWallet: function () { return wallet; } }; }
                };
            };

            return { order: order, wallet: wallet };
        }

        var MerchantResolverStub;

        beforeEach(function () {
            MerchantResolverStub = { resolveForOrder: function () { return { accountUpdaterMode: 'REAL_TIME' }; } };

            accountUpdaterHelper = proxyquire(
                '../../../../../cartridges/int_jpmc_core/cartridge/scripts/helpers/AccountUpdaterHelper',
                {
                    'dw/system/Logger': LoggerMock,
                    'dw/system/Transaction': TransactionMock,
                    'dw/order/PaymentInstrument': PIClass,
                    '*/cartridge/scripts/helpers/JPMCMerchantResolver': MerchantResolverStub
                }
            );
        });

        it('should skip when RTAU is disabled in resolved config', function () {
            MerchantResolverStub.resolveForOrder = function () { return { accountUpdaterMode: 'NONE' }; };
            var ctx = makeOrderWithWallet('test-tok-skip-001');
            accountUpdaterHelper.processRTAUForOrder(ctx.order, {
                accountUpdater: { accountUpdaterResponse: 'NEW_EXPIRY', newAccountExpiry: { month: '3', year: '2035' } }
            });
            assert.equal(ctx.wallet._instruments.length, 1);
            assert.equal(ctx.wallet._instruments[0].getCreditCardExpirationYear(), 2027); // unchanged
        });

        it('should skip silently when order is null', function () {
            assert.doesNotThrow(function () {
                accountUpdaterHelper.processRTAUForOrder(null, { accountUpdater: { accountUpdaterResponse: 'NEW_EXPIRY' } });
            });
        });

        it('should skip silently when responseData is null', function () {
            var ctx = makeOrderWithWallet('test-tok-skip-002');
            assert.doesNotThrow(function () {
                accountUpdaterHelper.processRTAUForOrder(ctx.order, null);
            });
            assert.equal(ctx.wallet._instruments.length, 1);
        });

        it('should skip when customer is a guest (isRegistered returns false)', function () {
            var order = new Order();
            order.getCustomer = function () { return { isRegistered: function () { return false; } }; };
            assert.doesNotThrow(function () {
                accountUpdaterHelper.processRTAUForOrder(order, {
                    accountUpdater: { accountUpdaterResponse: 'NEW_EXPIRY', newAccountExpiry: { month: '6', year: '2030' } }
                });
            });
        });

        it('should skip when order has no credit card PI (e.g. Apple Pay)', function () {
            var order = new Order();
            var wallet = new Wallet();
            order.getCustomer = function () {
                return {
                    isRegistered: function () { return true; },
                    getProfile: function () { return { getWallet: function () { return wallet; } }; }
                };
            };
            assert.doesNotThrow(function () {
                accountUpdaterHelper.processRTAUForOrder(order, {
                    accountUpdater: { accountUpdaterResponse: 'NEW_EXPIRY', newAccountExpiry: { month: '6', year: '2030' } }
                });
            });
            assert.equal(wallet._instruments.length, 0);
        });

        it('should skip when order PI has no token (not a stored card)', function () {
            var order = new Order();
            var wallet = new Wallet();
            var orderPI = order.createPaymentInstrument(PIClass.METHOD_CREDIT_CARD, 100);
            orderPI.setCreditCardToken(null);
            order.getCustomer = function () {
                return {
                    isRegistered: function () { return true; },
                    getProfile: function () { return { getWallet: function () { return wallet; } }; }
                };
            };
            accountUpdaterHelper.processRTAUForOrder(order, {
                accountUpdater: { accountUpdaterResponse: 'NEW_EXPIRY', newAccountExpiry: { month: '6', year: '2030' } }
            });
            assert.equal(wallet._instruments.length, 0);
        });

        it('should replace wallet PI for NEW_EXPIRY on a stored-card order', function () {
            var ctx = makeOrderWithWallet('test-tok-order-p1q');
            accountUpdaterHelper.processRTAUForOrder(ctx.order, {
                accountUpdater: {
                    accountUpdaterResponse: 'NEW_EXPIRY',
                    newAccountExpiry: { month: '2', year: '2036' }
                }
            });
            assert.equal(ctx.wallet._instruments.length, 1);
            var newPI = ctx.wallet._instruments[0];
            assert.equal(newPI.getCreditCardToken(), 'test-tok-order-p1q'); // token unchanged
            assert.equal(newPI.getCreditCardExpirationMonth(), 2);
            assert.equal(newPI.getCreditCardExpirationYear(), 2036);
        });

        it('should replace wallet PI for NEW_ACCOUNT_AND_EXPIRY on a stored-card order', function () {
            var ctx = makeOrderWithWallet('test-tok-order-r2s');
            accountUpdaterHelper.processRTAUForOrder(ctx.order, {
                accountUpdater: {
                    accountUpdaterResponse: 'NEW_ACCOUNT_AND_EXPIRY',
                    accountNumber: 'test-tok-order-s3t',
                    newAccountExpiry: { month: '5', year: '2037' }
                }
            });
            assert.equal(ctx.wallet._instruments.length, 1);
            var newPI = ctx.wallet._instruments[0];
            assert.equal(newPI.getCreditCardToken(), 'test-tok-order-s3t');
            assert.equal(newPI.getCreditCardExpirationMonth(), 5);
            assert.equal(newPI.getCreditCardExpirationYear(), 2037);
        });

        it('should not throw when an unexpected error occurs (best-effort)', function () {
            var order = new Order();
            order.getCustomer = function () { throw new Error('unexpected'); };
            assert.doesNotThrow(function () {
                accountUpdaterHelper.processRTAUForOrder(order, { accountUpdater: { accountUpdaterResponse: 'NEW_EXPIRY' } });
            });
        });
    });
});

