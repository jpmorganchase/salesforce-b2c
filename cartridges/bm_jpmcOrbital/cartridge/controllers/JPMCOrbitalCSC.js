/* eslint-disable consistent-return */
'use strict';
var ISML = require('dw/template/ISML');
var Transaction = require('dw/system/Transaction');
var Resource = require('dw/web/Resource');
var Decimal = require('dw/util/Decimal');
var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');
var csrfProtection = require('dw/web/CSRFProtection');
var JpmcCardPresentModel = require('*/cartridge/models/jpmcModels/jpmcCardPresentModel');

/**
 * update transaction
 * @param {Object} updatedResponse updated response
 * @param {Object} oldResponse old response
 * @param {*} order order
 * @param {string} actionName action name
 * @returns {Object} payment object
 */
function transactionUpdate(updatedResponse, oldResponse, order, actionName) {
    var paymentObject = oldResponse;
    paymentObject.merchant = updatedResponse.merchant;
    paymentObject.order = updatedResponse.order;
    var newOrder = order;
    Transaction.wrap(function () {
        newOrder.getPaymentInstruments()[0].paymentTransaction.custom.jpmcORetryTrace = paymentObject.order.retryTrace;
        newOrder.getPaymentInstruments()[0].paymentTransaction.custom.jpmcOUpdatedTransactionID = paymentObject.order.txRefNum;
        newOrder.getPaymentInstruments()[0].paymentTransaction.custom.jpmcOPaymentStatus = actionName;
    });
    return paymentObject;
}

/**
 * hide card number
 * @param {*} card carn nr
 * @returns {string} card nr
 */
function cardHide(card) {
    let hideNum = [];
    for (let i = 0; i < card.length; i++) {
        if (i < card.length - 4) {
            hideNum.push('*');
        } else {
            hideNum.push(card[i]);
        }
    }
    return hideNum.join('');
}

/**
 * Configuration tools
 */

exports.CustomerServiceCenter = function () {
    var OrderMgr = require('dw/order/OrderMgr');
    var preferenceHelper = require('*/cartridge/scripts/helpers/preferenceHelper');
    var JPMCOPaymentServices = require('*/cartridge/scripts/services/jpmcOServices');
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    var orderId = request.httpParameterMap.orderNo.stringValue || '';
    var captureOrder = request.httpParameterMap.capture.stringValue || null;
    var refundOrder = request.httpParameterMap.refund.stringValue || null;
    var reversalOrder = request.httpParameterMap.reversal.stringValue || null;
    var incrementalAuthorization = request.httpParameterMap.incrementalAuthorization.stringValue || null;
    var aIntroduced = request.httpParameterMap.amountIntroduced.stringValue || 0;
    var amountIntroduced;

    if (request.httpMethod !== 'GET') {
        var validateRequest = csrfProtection.validateRequest();
        if (!validateRequest) {
            ISML.renderTemplate('csrfFail');
            return null;
        }
    }

    if (aIntroduced !== JPMCOrbitalConstants.null) {
        amountIntroduced = new Decimal(aIntroduced);
    }
    var error = {
        isError: false,
        message: ''
    };
    var actionResponse;
    var order = OrderMgr.getOrder(orderId);
    var paymentInstruments = order.paymentInstruments;
    var paymentInstrumentsKeys = Object.keys(paymentInstruments);
    paymentInstrumentsKeys.forEach(function (index) {
        var paymentInstrument = paymentInstruments[index];
        if (paymentInstrument.paymentMethod.slice(0, 4) === JPMCOrbitalConstants.JPMC || paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD) {
            var transactionID = paymentInstrument.paymentTransaction.transactionID;
            var jpmcOPaymentTransactionResponse = JSON.parse(paymentInstrument.paymentTransaction.custom.jpmcpg__OrbitalResponseMessage.split('|')[1]);
            var updatedTransactionID = paymentInstrument.paymentTransaction.custom.jpmcOUpdatedTransactionID;
            var retryTrace = paymentInstrument.paymentTransaction.custom.jpmcORetryTrace;
            var transactionDetails;
            var paymentStatus = '';
            var amount = new Decimal(paymentInstrument.paymentTransaction.amount.value);
            if (paymentInstrument.paymentTransaction.custom.jpmcOPaymentIncrementedAmount) {
                amount = amount.add(paymentInstrument.paymentTransaction.custom.jpmcOPaymentIncrementedAmount);
            }
            var renderCaptureAmountField = false;
            var paymentProfileActive = false;
            var remainedAmount;
            var hiddenCardNr = '';
            var locale = order.customerLocaleID;

            if (paymentInstrument.paymentTransaction.custom.jpmcOPaymentRemainedAmount || paymentInstrument.paymentTransaction.custom.jpmcOPaymentRemainedAmount === 0) {
                remainedAmount = new Decimal(paymentInstrument.paymentTransaction.custom.jpmcOPaymentRemainedAmount);
            } else {
                remainedAmount = amount;
            }
            var token;
            var profileToken = paymentInstrument.creditCardToken;
            if (profileToken) {
                token = profileToken;
            }
            var savedProfile = paymentInstrument.paymentTransaction.custom.jpmcOPaymentSavedProfile;
            var incrementalAuthorizationEnabled = false;
            if (preferenceHelper.isIncrementalAuthorizationEnabled(locale)) {
                incrementalAuthorizationEnabled = true;
            }
            if (paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD) {
                if (paymentInstrument.creditCardType === JPMCOrbitalConstants.Visa) {
                    renderCaptureAmountField = true;
                } else if (!empty(profileToken) && savedProfile) {
                    renderCaptureAmountField = true;
                    paymentProfileActive = true;
                }
            } else if ((paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_CARD ||
                paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_ELECTRONIC_CHECK ||
                paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_GOOGLE_PAY ||
                paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_VISA_CHECKOUT ||
                paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_APPLE_PAY) ||
                paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD ||
                paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD ||
                paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD) {
                if (!empty(profileToken) && savedProfile) {
                    renderCaptureAmountField = true;
                    paymentProfileActive = true;
                }
            }
            if (jpmcOPaymentTransactionResponse) {
                paymentStatus = paymentInstrument.paymentTransaction.custom.jpmcOPaymentStatus;
                if (paymentStatus === JPMCOrbitalConstants.AuthorizationAndCapture) {
                    Transaction.wrap(function () {
                        paymentInstrument.paymentTransaction.custom.jpmcOPaymentCapturedAmount = remainedAmount;
                    });
                    remainedAmount = new Decimal(0);
                }
                var JPMCOServices = require('*/cartridge/scripts/services/jpmcOServices.js');
                var services = new JPMCOServices();
                var updatedTransaction;
                if (incrementalAuthorization) {
                    var inquiryResponse = services.inquiry(jpmcOPaymentTransactionResponse, retryTrace, locale);
                    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject(inquiryResponse.responseBody.merchant.bin));
                    if (inquiryResponse.status === JPMCOrbitalConstants.OK) {
                        var incrementalAmount;
                        if (remainedAmount) {
                            incrementalAmount = remainedAmount.add(amountIntroduced);
                        } else {
                            incrementalAmount = amount.add(amountIntroduced);
                        }
                        var incrementalObject = {};
                        incrementalObject.merchant = { bin: inquiryResponse.responseBody.merchant.bin,
                            terminalID: inquiryResponse.responseBody.merchant.terminalID
                        };
                        incrementalObject.version = JPMCOrbitalConstants.version;
                        incrementalObject.transType = JPMCOrbitalConstants.Authorization;
                        if (token.length > 9) {
                            incrementalObject.paymentInstrument = {
                                card: {
                                    cardBrand: inquiryResponse.responseBody.paymentInstrument.card.cardBrand,
                                    ccAccountNum: token,
                                    ccExp: paymentInstrument.creditCardExpirationYear.toString() + ((JPMCOrbitalConstants.n_0 + paymentInstrument.creditCardExpirationMonth).slice(-2).toString()),
                                    tokenTxnType: JPMCOrbitalConstants.UT
                                }
                            };
                            if (paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD) {
                                incrementalObject.paymentInstrument.card.ccExp = JPMCOrbitalConstants.n_20 + paymentInstrument.creditCardExpirationYear.toString() + ((JPMCOrbitalConstants.n_0 + paymentInstrument.creditCardExpirationMonth).slice(-2).toString());
                            }
                        } else {
                            incrementalObject.paymentInstrument = {
                                useProfile: {
                                    useCustomerRefNum: token
                                }
                            };
                        }
                        incrementalObject.order = { orderID: inquiryResponse.responseBody.order.orderID,
                            amount: amountIntroduced.multiply(100).get(),
                            retryTrace: orbitalAPIHelper.getRetryTrace(inquiryResponse.responseBody.order.orderID, JPMCOrbitalConstants.incrementalAuthorization),
                            txRefNum: transactionID,
                            industryType: JPMCOrbitalConstants.EC
                        };
                        incrementalObject.cardPresent = {
                            emvInfo: {
                                vendorID: CardPresentModel.vendorID,
                                softwareID: CardPresentModel.softwareID
                            }
                        };
                        incrementalObject.merchantInitiatedTransaction = {
                            mitMsgType: JPMCOrbitalConstants.MINC
                        };
                        if (inquiryResponse.responseBody.paymentInstrument.card.cardBrand === JPMCOrbitalConstants.MC || inquiryResponse.responseBody.paymentInstrument.card.cardBrand === JPMCOrbitalConstants.IM) {
                            incrementalObject.additionalAuthInfo = {};
                            incrementalObject.additionalAuthInfo.paymentActionInd = JPMCOrbitalConstants.P;
                        }
                        var service = new JPMCOPaymentServices();
                        var incrementalTransactionObject = service.payments(incrementalObject, locale);
                        var incrementedAmount;
                        var newIncAmount;
                        if (incrementalTransactionObject.responseBody) {
                            remainedAmount = incrementalAmount;
                            if (paymentInstrument.paymentTransaction.custom.jpmcOPaymentIncrementedAmount) {
                                incrementedAmount = amountIntroduced.add(paymentInstrument.paymentTransaction.custom.jpmcOPaymentIncrementedAmount);
                                newIncAmount = remainedAmount;
                            } else {
                                incrementedAmount = amountIntroduced;
                                newIncAmount = incrementalAmount;
                            }
                            amount = amount.add(amountIntroduced);
                            Transaction.wrap(function () {
                                paymentInstrument.paymentTransaction.custom.jpmcOPaymentIncrementedAmount = incrementedAmount.get();
                                paymentInstrument.paymentTransaction.custom.jpmcOPaymentRemainedAmount = newIncAmount.get();
                                order.addNote(JPMCOrbitalConstants.JPMC, (JPMCOrbitalConstants.incrementalAuthorization + JPMCOrbitalConstants.Status_Message + jpmcOPaymentTransactionResponse.order.status.procStatusMessage + JPMCOrbitalConstants.TxRefNumber + transactionID));
                            });
                            paymentStatus = JPMCOrbitalConstants.IA;
                        } else {
                            error = {
                                isError: true,
                                message: incrementalTransactionObject.errorMessage
                            };
                        }
                    } else {
                        error = {
                            isError: true,
                            message: actionResponse.errorMessage
                        };
                    }
                } else if (reversalOrder) {
                    if (remainedAmount) {
                        amountIntroduced = remainedAmount;
                    } else {
                        amountIntroduced = amount;
                    }
                    if (updatedTransactionID) {
                        actionResponse = services.reversal(jpmcOPaymentTransactionResponse, JPMCOrbitalConstants.N, locale, updatedTransactionID);
                    } else if (paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD || paymentInstrument.paymentTransaction.paymentInstrument.creditCardType === JPMCOrbitalConstants.EC) {
                        actionResponse = services.reversal(jpmcOPaymentTransactionResponse, JPMCOrbitalConstants.N, locale, transactionID);
                    } else {
                        actionResponse = services.reversal(jpmcOPaymentTransactionResponse, JPMCOrbitalConstants.Y, locale, transactionID);
                    }
                    if (actionResponse.status === JPMCOrbitalConstants.OK) {
                        var reversalAmount;
                        remainedAmount = amount.subtract(amountIntroduced);
                        if (!paymentInstrument.paymentTransaction.custom.jpmcOPaymentReversedAmount) {
                            reversalAmount = amountIntroduced;
                        } else {
                            reversalAmount = amountIntroduced.add(paymentInstrument.paymentTransaction.custom.jpmcOPaymentReversedAmount);
                        }

                        remainedAmount = new Decimal(0);
                        Transaction.wrap(function () {
                            paymentInstrument.paymentTransaction.custom.jpmcOPaymentReversedAmount = reversalAmount.get();
                            paymentInstrument.paymentTransaction.custom.jpmcOPaymentRemainedAmount = 0;
                            order.addNote(JPMCOrbitalConstants.JPMC, (JPMCOrbitalConstants.reversal + JPMCOrbitalConstants.Status_Message + jpmcOPaymentTransactionResponse.order.status.procStatusMessage + JPMCOrbitalConstants.TxRefNumber + updatedTransactionID));
                        });
                        paymentStatus = JPMCOrbitalConstants.RV;
                        updatedTransaction = transactionUpdate(actionResponse.responseBody, jpmcOPaymentTransactionResponse, order, paymentStatus);
                    } else {
                        error = {
                            isError: true,
                            message: actionResponse.errorMessage
                        };
                    }
                } else if (captureOrder) {
                    if (amountIntroduced === 0 || !amountIntroduced) {
                        if (remainedAmount) {
                            amountIntroduced = remainedAmount;
                        } else {
                            amountIntroduced = amount;
                        }
                    }
                    var nAmount;
                    if (aIntroduced !== JPMCOrbitalConstants.null) {
                        var newAmount = amountIntroduced.multiply(100);
                        nAmount = newAmount.get();
                    }
                    if (updatedTransactionID) {
                        actionResponse = services.capture(jpmcOPaymentTransactionResponse, nAmount, locale, updatedTransactionID);
                    } else {
                        actionResponse = services.capture(jpmcOPaymentTransactionResponse, nAmount, locale, transactionID);
                    }
                    if (actionResponse.status === JPMCOrbitalConstants.OK) {
                        remainedAmount = amount.subtract(amountIntroduced);
                        var capturedAmount;
                        var remainedCapturedAmount;
                        if (paymentInstrument.paymentTransaction.custom.jpmcOPaymentCapturedAmount) {
                            capturedAmount = amountIntroduced.add(paymentInstrument.paymentTransaction.custom.jpmcOPaymentCapturedAmount);
                            remainedCapturedAmount = remainedAmount.subtract(paymentInstrument.paymentTransaction.custom.jpmcOPaymentCapturedAmount);
                        } else {
                            capturedAmount = amountIntroduced;
                            remainedCapturedAmount = remainedAmount;
                        }
                        remainedAmount = remainedCapturedAmount;
                        Transaction.wrap(function () {
                            if (amountIntroduced.get() !== amount.get()) {
                                order.setPaymentStatus(1);
                            } else {
                                order.setPaymentStatus(2);
                            }
                            paymentInstrument.paymentTransaction.custom.jpmcOPaymentCapturedAmount = capturedAmount.get();
                            paymentInstrument.paymentTransaction.custom.jpmcOPaymentRemainedAmount = remainedCapturedAmount.get();
                            order.addNote(JPMCOrbitalConstants.JPMC, (JPMCOrbitalConstants.capture + JPMCOrbitalConstants.Status_Message + jpmcOPaymentTransactionResponse.order.status.procStatusMessage + JPMCOrbitalConstants.TxRefNumber + transactionID));
                        });
                        if (paymentProfileActive && token && paymentInstrument.creditCardType !== JPMCOrbitalConstants.Visa) {
                            if (capturedAmount.get() !== amount.get()) {
                                if (updatedTransactionID) {
                                    actionResponse = services.reversal(actionResponse.responseBody, JPMCOrbitalConstants.N, locale, updatedTransactionID);
                                } else {
                                    actionResponse = services.reversal(actionResponse.responseBody, JPMCOrbitalConstants.N, locale, transactionID);
                                }
                                if (actionResponse.status === JPMCOrbitalConstants.OK) {
                                    var inquiryForCaptureResponse = services.inquiry(jpmcOPaymentTransactionResponse, retryTrace, locale);
                                    if (inquiryForCaptureResponse.status === JPMCOrbitalConstants.OK) {
                                        var newObject = {};
                                        newObject.merchant = {
                                            bin: actionResponse.responseBody.merchant.bin,
                                            terminalID: actionResponse.responseBody.merchant.terminalID
                                        };
                                        newObject.version = actionResponse.responseBody.version;
                                        newObject.transType = jpmcOPaymentTransactionResponse.transType;
                                        if (token.length > 9) {
                                            newObject.paymentInstrument = {
                                                card: {
                                                    cardBrand: inquiryForCaptureResponse.responseBody.paymentInstrument.card.cardBrand,
                                                    ccAccountNum: token,
                                                    ccExp: paymentInstrument.creditCardExpirationYear.toString() + ((JPMCOrbitalConstants.n_0 + paymentInstrument.creditCardExpirationMonth).slice(-2).toString()),
                                                    tokenTxnType: JPMCOrbitalConstants.UT
                                                }
                                            };
                                            if (paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD) {
                                                newObject.paymentInstrument.card.ccExp = JPMCOrbitalConstants.n_20 + paymentInstrument.creditCardExpirationYear.toString() + ((JPMCOrbitalConstants.n_0 + paymentInstrument.creditCardExpirationMonth).slice(-2).toString());
                                            }
                                        } else {
                                            newObject.paymentInstrument = {
                                                useProfile: {
                                                    useCustomerRefNum: token
                                                }
                                            };
                                        }
                                        newObject.order = {
                                            orderID: actionResponse.responseBody.order.orderID,
                                            amount: remainedCapturedAmount.multiply(100).get(),
                                            retryTrace: orbitalAPIHelper.getRetryTrace(actionResponse.responseBody.order.orderID, JPMCOrbitalConstants.reversal),
                                            industryType: JPMCOrbitalConstants.EC
                                        };
                                        newObject.merchantInitiatedTransaction = {
                                            mitMsgType: JPMCOrbitalConstants.MUSE,
                                            mitStoredCredentialInd: JPMCOrbitalConstants.Y
                                        };
                                        if (inquiryForCaptureResponse.responseBody.paymentInstrument.card.cardBrand === JPMCOrbitalConstants.MC || inquiryForCaptureResponse.responseBody.paymentInstrument.card.cardBrand === JPMCOrbitalConstants.IM) {
                                            newObject.additionalAuthInfo = {};
                                            newObject.additionalAuthInfo.paymentActionInd = JPMCOrbitalConstants.P;
                                        }
                                        var pService = new JPMCOPaymentServices();
                                        actionResponse = pService.payments(newObject, locale);
                                        if (actionResponse.responseBody) {
                                            Transaction.wrap(function () {
                                                paymentInstrument.paymentTransaction.custom.jpmcOPaymentReversedAmount = remainedCapturedAmount.get();
                                                paymentInstrument.paymentTransaction.custom.jpmcOPaymentRemainedAmount = remainedCapturedAmount.get();
                                                order.addNote(JPMCOrbitalConstants.JPMC, (JPMCOrbitalConstants.reversal + JPMCOrbitalConstants.Status_Message + jpmcOPaymentTransactionResponse.order.status.procStatusMessage + JPMCOrbitalConstants.TxRefNumber + transactionID));
                                            });
                                            paymentStatus = JPMCOrbitalConstants.PC;
                                            updatedTransaction = transactionUpdate(actionResponse.responseBody, jpmcOPaymentTransactionResponse, order, paymentStatus);
                                        } else {
                                            error = {
                                                isError: true,
                                                message: actionResponse.errorMessage
                                            };
                                        }
                                    } else {
                                        error = {
                                            isError: true,
                                            message: actionResponse.errorMessage
                                        };
                                    }
                                }
                            } else {
                                paymentStatus = JPMCOrbitalConstants.C;
                                updatedTransaction = transactionUpdate(actionResponse.responseBody, jpmcOPaymentTransactionResponse, order, paymentStatus);
                            }
                        } else {
                            if (amountIntroduced.get() === amount.get() || capturedAmount.get() === amount.get()) {
                                paymentStatus = JPMCOrbitalConstants.C;
                            } else {
                                paymentStatus = JPMCOrbitalConstants.PC;
                            }
                            updatedTransaction = transactionUpdate(actionResponse.responseBody, jpmcOPaymentTransactionResponse, order, paymentStatus);
                        }
                    } else {
                        error = {
                            isError: true,
                            message: actionResponse.errorMessage
                        };
                    }
                } else if (refundOrder) {
                    var amountToBeRefunded;
                    if (aIntroduced !== JPMCOrbitalConstants.null) {
                        if ((paymentInstrument.paymentTransaction.custom.jpmcOPaymentRefundedAmount && amountIntroduced.add(paymentInstrument.paymentTransaction.custom.jpmcOPaymentRefundedAmount).get()) <= paymentInstrument.paymentTransaction.custom.jpmcOPaymentCapturedAmount || amountIntroduced.get() <= paymentInstrument.paymentTransaction.custom.jpmcOPaymentCapturedAmount) {
                            var newRefundAmount = amountIntroduced.multiply(100);
                            amountToBeRefunded = newRefundAmount.get();
                        } else {
                            error = {
                                isError: true,
                                message: Resource.msg('csc.error.amount', 'jpmcorbitalbm', null, paymentInstrument.paymentTransaction.custom.jpmcOPaymentCapturedAmount - paymentInstrument.paymentTransaction.custom.jpmcOPaymentRefundedAmount)
                            };
                        }
                    } else {
                        amountIntroduced = new Decimal(paymentInstrument.paymentTransaction.custom.jpmcOPaymentCapturedAmount - paymentInstrument.paymentTransaction.custom.jpmcOPaymentRefundedAmount);
                    }
                    actionResponse = services.refund(jpmcOPaymentTransactionResponse, amountToBeRefunded, locale, transactionID);
                    if (actionResponse.status === JPMCOrbitalConstants.OK) {
                        remainedAmount = remainedAmount.add(amountIntroduced);
                        var refundAmount;
                        if (paymentInstrument.paymentTransaction.custom.jpmcOPaymentRefundedAmount) {
                            refundAmount = amountIntroduced.add(paymentInstrument.paymentTransaction.custom.jpmcOPaymentRefundedAmount);
                        } else {
                            refundAmount = amountIntroduced;
                        }
                        if (refundAmount.get() === paymentInstrument.paymentTransaction.custom.jpmcOPaymentCapturedAmount || aIntroduced === JPMCOrbitalConstants.null) {
                            paymentStatus = JPMCOrbitalConstants.RF;
                        } else {
                            paymentStatus = JPMCOrbitalConstants.PRF;
                        }
                        remainedAmount = new Decimal(0);
                        Transaction.wrap(function () {
                            paymentInstrument.paymentTransaction.custom.jpmcOPaymentRefundedAmount = refundAmount.get();
                            paymentInstrument.paymentTransaction.custom.jpmcOPaymentRemainedAmount = remainedAmount.get();
                            order.addNote(JPMCOrbitalConstants.JPMC, (JPMCOrbitalConstants.refund + JPMCOrbitalConstants.Status_Message + actionResponse.responseBody.order.status.procStatusMessage + JPMCOrbitalConstants.TxRefNumber + transactionID));
                        });
                        updatedTransaction = transactionUpdate(actionResponse.responseBody, jpmcOPaymentTransactionResponse, order, paymentStatus);
                    } else {
                        error = {
                            isError: true,
                            message: actionResponse.errorMessage
                        };
                    }
                } else {
                    actionResponse = false;
                }
                if (updatedTransaction) {
                    actionResponse = services.inquiry(updatedTransaction, retryTrace, locale);
                    if (actionResponse.status === JPMCOrbitalConstants.OK) {
                        transactionDetails = actionResponse.responseBody;
                    } else {
                        error = {
                            isError: true,
                            message: actionResponse.errorMessage
                        };
                    }
                } else {
                    actionResponse = services.inquiry(jpmcOPaymentTransactionResponse, retryTrace, locale);
                    if (actionResponse.status === JPMCOrbitalConstants.OK) {
                        transactionDetails = actionResponse.responseBody;
                    } else {
                        error = {
                            isError: true,
                            message: actionResponse.errorMessage
                        };
                    }
                }
                if (transactionDetails && transactionDetails.paymentInstrument.card) {
                    if (transactionDetails.paymentInstrument.card.cardBrand !== JPMCOrbitalConstants.EC) {
                        hiddenCardNr = cardHide(transactionDetails.paymentInstrument.card.ccAccountNum);
                    }
                }
            } else {
                error = {
                    isError: true,
                    message: Resource.msg('error.service.response', 'jpmcorbitalbm', null)
                };
            }

            var csrf = {
                tokenName: csrfProtection.getTokenName(),
                token: csrfProtection.generateToken()
            };

            ISML.renderTemplate('csc/order', {
                orderId: orderId,
                transactionDetails: transactionDetails,
                paymentStatus: paymentStatus,
                amount: amount,
                renderCaptureAmountField: renderCaptureAmountField,
                incrementalAuthorizationEnabled: incrementalAuthorizationEnabled,
                remainedAmount: remainedAmount,
                orderTransaction: paymentInstrument.paymentTransaction,
                hiddenCardNr: hiddenCardNr,
                error: error,
                csrf: csrf
            });
        }
    });
};

exports.CustomerServiceCenter.public = true;
