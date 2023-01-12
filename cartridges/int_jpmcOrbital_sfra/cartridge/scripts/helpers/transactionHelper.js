var collections = require('*/cartridge/scripts/util/collections');
var Transaction = require('dw/system/Transaction');
var OrbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
var JPMCLogger = require('dw/system/Logger').getLogger('JPMCLogger', 'JPMCLogger');
var OrderMgr = require('dw/order/OrderMgr');
var PaymentResponseModel = require('*/cartridge/models/paymentResponseModel');
var AVSPaymentResponseModel = require('*/cartridge/models/jpmcModels/jpmcAVSResponseModel');
var HookMgr = require('dw/system/HookMgr');
var preferenceHelper = require('*/cartridge/scripts/helpers/preferenceHelper');
var PaymentTransaction = require('dw/order/PaymentTransaction');
var Order = require('dw/order/Order');
var profileAddModel = require('*/cartridge/models/jpmcModels/jpmcProfileAddModel');
var JPMCOProfileServices = require('*/cartridge/scripts/services/jpmcOServices.js');
var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');

/**
 * @function getHandleTransaction
 * @param {Object} paymentInformation - Selected payment instrument by customer or payment information object
 * @param {dw.order.Basket} currentBasket Current users's basket
 * @param {string} paymentMethodId - paymentMethodId
 * @param {string} securityCode - securityCode
 * @param {string} saveCustomerPaymentCheckbox - saveCustomerPaymentCheckbox
 * @param {string} googlePayToken - googlePayToken
 * @param {string} visaPay - visaPay
 * @param {string} applePayToken - applePayToken
 */
function getHandleTransaction(paymentInformation, currentBasket, paymentMethodId, securityCode, saveCustomerPaymentCheckbox, googlePayToken, visaPay, applePayToken) {
    Transaction.wrap(function () {
        var amount = currentBasket.getTotalGrossPrice();
        var paymentInstruments = currentBasket.getPaymentInstruments();
        var debundlePaymentObject;
        var debundlePaymentInfo;
        collections.forEach(paymentInstruments, function (item) {
            if (paymentInformation && paymentInformation.UUID) {
                if (item.UUID !== paymentInformation.UUID) {
                    currentBasket.removePaymentInstrument(item);
                }
            } else {
                currentBasket.removePaymentInstrument(item);
            }
        });
        var paymentInstrument = currentBasket.createPaymentInstrument(paymentMethodId, amount);
        if (paymentMethodId === JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD) {
            paymentInstrument.setCreditCardHolder(currentBasket.billingAddress.fullName);
            paymentInstrument.setCreditCardNumber(paymentInformation.cardNumber.value);
            paymentInstrument.setCreditCardExpirationMonth(paymentInformation.expirationMonth.value);
            paymentInstrument.setCreditCardExpirationYear(paymentInformation.expirationYear.value);
            paymentInstrument.setCreditCardType(paymentInformation.cardType.value);
            paymentInstrument.custom.jpmco_cardNumber = paymentInstrument.maskedCreditCardNumber;
            paymentInstrument.custom.jpmco_cardHolderName = paymentInstrument.creditCardHolder;
        } else if (paymentMethodId === JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD) {
            debundlePaymentObject = OrbitalAPIHelper.prepareDebundlePaymentObjectForGooglePay(googlePayToken);
            debundlePaymentInfo = OrbitalAPIHelper.debundlePaymentInfoForGooglePay(debundlePaymentObject);
            paymentInstrument.setCreditCardHolder(currentBasket.billingAddress.fullName);
            paymentInstrument.setCreditCardNumber(debundlePaymentInfo.TokenData.pan);
            paymentInstrument.setCreditCardExpirationMonth(parseInt(debundlePaymentInfo.TokenData.expirationMonth, 10));
            paymentInstrument.setCreditCardExpirationYear(parseInt(debundlePaymentInfo.TokenData.expirationYear, 10));
            paymentInstrument.setCreditCardType(JPMCOrbitalConstants.GOOGLE);
            paymentInstrument.custom.jpmco_cardNumber = paymentInstrument.maskedCreditCardNumber;
            paymentInstrument.custom.jpmco_cardHolderName = paymentInstrument.creditCardHolder;
            session.privacy.googlePayToken = googlePayToken;
        } else if (paymentMethodId === JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD) {
            debundlePaymentObject = OrbitalAPIHelper.prepareDebundlePaymentObjectForVisaPay(visaPay);
            debundlePaymentInfo = OrbitalAPIHelper.debundlePaymentInfoForVisaPay(debundlePaymentObject);
            paymentInstrument.setCreditCardHolder(currentBasket.billingAddress.fullName);
            paymentInstrument.setCreditCardNumber(debundlePaymentInfo.TokenData.accountNumber);
            paymentInstrument.setCreditCardExpirationMonth(parseInt(debundlePaymentInfo.TokenData.expirationMonth, 10));
            paymentInstrument.setCreditCardExpirationYear(parseInt(debundlePaymentInfo.TokenData.expirationYear, 10));
            paymentInstrument.setCreditCardType(JPMCOrbitalConstants.VISA_CHECKOUT);
            paymentInstrument.custom.jpmco_cardNumber = paymentInstrument.maskedCreditCardNumber;
            paymentInstrument.custom.jpmco_cardHolderName = paymentInstrument.creditCardHolder;
            session.privacy.visaPay = visaPay;
        } else if (paymentMethodId === JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD) {
            debundlePaymentObject = OrbitalAPIHelper.prepareDebundlePaymentObjectForApplePay(applePayToken);
            debundlePaymentInfo = OrbitalAPIHelper.debundlePaymentInfoForApplePay(debundlePaymentObject);
            paymentInstrument.setCreditCardHolder(currentBasket.billingAddress.fullName);
            paymentInstrument.setCreditCardNumber(debundlePaymentInfo.TokenData.applicationPrimaryAccountNumber);
            paymentInstrument.setCreditCardExpirationMonth(parseInt(debundlePaymentInfo.TokenData.applicationExpirationDate.slice(2, 4), 10));
            paymentInstrument.setCreditCardExpirationYear(parseInt(debundlePaymentInfo.TokenData.applicationExpirationDate.slice(0, 2), 10));
            paymentInstrument.custom.jpmco_cardNumber = paymentInstrument.maskedCreditCardNumber;
            paymentInstrument.custom.jpmco_cardHolderName = paymentInstrument.creditCardHolder;
            paymentInstrument.setCreditCardType(JPMCOrbitalConstants.APPLE);

            var tokenLength = applePayToken.length;
            session.privacy.applePayToken1 = applePayToken.substring(0, tokenLength / 2);
            session.privacy.applePayToken2 = applePayToken.substring(tokenLength / 2);
        } else if (paymentMethodId === JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD) {
            paymentInstrument.setBankRoutingNumber(paymentInformation.ecpCheckRT);
            paymentInstrument.setBankAccountNumber(paymentInformation.ecpCheckDDA);
            session.privacy.ecpCheckDDA = paymentInstrument.getMaskedBankAccountNumber();
            session.privacy.ecpCheckRT = paymentInstrument.getBankRoutingNumber();
            session.privacy.ecpBankAcctType = paymentInformation.ecpBankAcctType;
        } else if (paymentMethodId === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD) {
            if (paymentInformation.creditCardType !== JPMCOrbitalConstants.EC) {
                paymentInstrument.setCreditCardHolder(currentBasket.billingAddress.fullName);
                paymentInstrument.setCreditCardExpirationMonth(paymentInformation.creditCardExpirationMonth);
                paymentInstrument.setCreditCardExpirationYear(paymentInformation.creditCardExpirationYear);
                paymentInstrument.setCreditCardNumber(paymentInformation.creditCardNumber);
                paymentInstrument.custom.jpmco_cardNumber = paymentInformation.creditCardNumber;
                paymentInstrument.custom.jpmco_cardHolderName = paymentInstrument.creditCardHolder;
                session.privacy.cardBrand = paymentInformation.custom.jpmco_cardBrand;
            } else {
                paymentInstrument.setCreditCardNumber(paymentInformation.custom.jpmco_ecp_ecpCheckDDA);
                paymentInstrument.setBankAccountNumber(paymentInformation.custom.jpmco_ecp_ecpCheckDDA);
                paymentInstrument.setBankRoutingNumber(paymentInformation.custom.jpmco_ecp_ecpCheckRT);
                session.privacy.ecpCheckDDA = paymentInstrument.getBankAccountNumber();
                session.privacy.ecpCheckRT = paymentInstrument.getBankRoutingNumber();
            }
            paymentInstrument.setCreditCardType(paymentInformation.creditCardType);
            paymentInstrument.setCreditCardToken(paymentInformation.creditCardToken);
        }
        if (paymentInformation) {
            if (paymentInformation.creditCardType === JPMCOrbitalConstants.VISA_CHECKOUT && paymentMethodId === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD) {
                session.privacy.profile_visa = true;
            } else {
                session.privacy.profile_visa = null;
            }
        } else {
            session.privacy.profile_visa = null;
        }
        if (securityCode) {
            session.privacy.orbitalCardCode = securityCode;
        }

        if (saveCustomerPaymentCheckbox) {
            session.privacy.saveCustomerPaymentCheckbox = saveCustomerPaymentCheckbox;
        } else {
            session.privacy.saveCustomerPaymentCheckbox = null;
        }
    });
}
/**
 * @description Create payment data and make call to API
 * @param {number} orderNumber - The current order's number
 * @param {dw.order.PaymentInstrument} PaymentInstrument -  The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor -  The payment processor of the current payment method
 * @returns {Object} - Object containing errors or redirect token and URL
 */
function getAuthorize(orderNumber, PaymentInstrument, paymentProcessor) {
    var paymentInstrument = PaymentInstrument;
    var order = OrderMgr.getOrder(orderNumber);
    var serverErrors = [];
    var error = false;
    var paymentObject;
    var paymentResponse;
    var data;
    var cardData;
    var securityCode;
    var saveProfile = false;
    var profileAddResponse;
    var googlePayToken;
    var applePayToken;
    var tokenData;
    var cardBrand;
    var AuthorizeFile;
    var visaPay;
    var debundlePaymentObject;
    var debundlePaymentInfo;
    var profileAddObject;
    var formData;
    var paymentMethod = paymentInstrument.paymentMethod;
    var profileServices = new JPMCOProfileServices();
    if (session.privacy.orbitalCardCode) {
        securityCode = session.privacy.orbitalCardCode;
    }
    if (session.privacy.googlePayToken) {
        googlePayToken = session.privacy.googlePayToken;
    }
    if (session.privacy.visaPay) {
        visaPay = session.privacy.visaPay;
    }
    if (session.privacy.applePayToken1 && session.privacy.applePayToken2) {
        applePayToken = session.privacy.applePayToken1 + session.privacy.applePayToken2;
    }
    if (paymentInstrument.creditCardExpirationMonth && paymentInstrument.creditCardExpirationYear && paymentInstrument.creditCardType) {
        cardData = {
            expirationMonth: { value: paymentInstrument.creditCardExpirationMonth },
            expirationYear: { value: paymentInstrument.creditCardExpirationYear },
            cardType: { value: paymentInstrument.creditCardType }
        };
    }
    if (paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD) {
        AuthorizeFile = 'jpmcOrbitalCard.js';
        if (cardData) {
            cardData.cardNumber = { value: paymentInstrument.creditCardNumber };
            cardData.securityCode = { value: securityCode };
        }
        data = cardData;
        session.privacy.orbitalCardCode = null;
        paymentObject = OrbitalAPIHelper.preparePaymentObjectForCard(order, cardData, paymentMethod);
        paymentResponse = OrbitalAPIHelper.makePaymentCallForCard(paymentObject);
        if (preferenceHelper.isIncrementalAuthorizationEnabled()) {
            saveProfile = true;
        }
    } else if (paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD) {
        AuthorizeFile = 'jpmcOrbitalElectronicCheck.js';
        var electronicCheckData = {
            ecpCheckDDA: { value: paymentInstrument.bankAccountNumber },
            ecpCheckRT: { value: paymentInstrument.bankRoutingNumber },
            ecpBankAcctType: { value: session.privacy.ecpBankAcctType }
        };
        data = electronicCheckData;
        session.privacy.ecpBankAcctType = null;
        paymentObject = OrbitalAPIHelper.preparePaymentObjectForElectronicCheck(order, electronicCheckData);
        paymentResponse = OrbitalAPIHelper.makePaymentCallForElectronicCheck(paymentObject);
    } else if (paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD) {
        AuthorizeFile = 'jpmcGooglePay.js';
        session.privacy.googlePayToken = null;
        session.privacy.orbitalCardCode = null;
        paymentObject = OrbitalAPIHelper.preparePaymentObjectForGooglePay(order, googlePayToken, securityCode, paymentMethod);
        paymentResponse = OrbitalAPIHelper.makePaymentCallForGooglePay(paymentObject);
        if (preferenceHelper.isIncrementalAuthorizationEnabled()) {
            saveProfile = true;
        }
    } else if (paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD && !session.privacy.profile_visa) {
        AuthorizeFile = 'jpmcOrbitalVisaPay.js';
        session.privacy.visaPay = null;
        session.privacy.orbitalCardCode = null;
        paymentObject = OrbitalAPIHelper.preparePaymentObjectForVisaPay(order, visaPay, securityCode, paymentMethod);
        paymentResponse = OrbitalAPIHelper.makePaymentCallForVisaPay(paymentObject);
        if (preferenceHelper.isIncrementalAuthorizationEnabled()) {
            saveProfile = true;
        }
    } else if (paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD) {
        AuthorizeFile = 'jpmcApplePay.js';
        session.privacy.applePayToken1 = null;
        session.privacy.applePayToken2 = null;
        session.privacy.orbitalCardCode = null;
        paymentObject = OrbitalAPIHelper.preparePaymentObjectForApplePay(order, applePayToken, securityCode);
        paymentResponse = OrbitalAPIHelper.makePaymentCallForApplePay(paymentObject);
        if (preferenceHelper.isIncrementalAuthorizationEnabled()) {
            saveProfile = true;
        }
    } else if (paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_CARD || paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_ELECTRONIC_CHECK || paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_GOOGLE_PAY || session.privacy.profile_visa || paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_APPLE_PAY) {
        AuthorizeFile = 'jpmcOrbitalProfile.js';
        var customerRefNum = paymentInstrument.creditCardToken;
        var customerPaymentType = paymentInstrument.creditCardType;
        if (cardData) {
            cardData.cardNumber = { value: customerRefNum };
            cardData.securityCode = { value: securityCode };
            cardData.cardBrand = { value: paymentInstrument.custom.jpmco_cardBrand };
        }
        data = cardData;

        if (preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.safetechToken && customerPaymentType !== JPMCOrbitalConstants.EC) {
            paymentObject = OrbitalAPIHelper.preparePaymentObjectForCard(order, cardData, paymentMethod);
            if (customerPaymentType === JPMCOrbitalConstants.GOOGLE || customerPaymentType === JPMCOrbitalConstants.VISA_CHECKOUT || customerPaymentType === JPMCOrbitalConstants.APPLE) {
                paymentObject.paymentInstrument.card.cardBrand = session.privacy.cardBrand;
                paymentObject.paymentInstrument.card.tokenTxnType = JPMCOrbitalConstants.UT;
                paymentObject.paymentInstrument.customerAccountType = JPMCOrbitalConstants.CC;
            }
            paymentResponse = OrbitalAPIHelper.makePaymentCallForCard(paymentObject);
        } else {
            paymentObject = OrbitalAPIHelper.preparePaymentObjectForProfile(order, customerRefNum, customerPaymentType, securityCode);
            paymentResponse = OrbitalAPIHelper.makePaymentCallForProfile(paymentObject);
        }
        session.privacy.orbitalCardCode = null;
    }
    var responseObject = {};
    var token;
    if (paymentResponse) {
        responseObject = new PaymentResponseModel(paymentResponse);
        if (Object.keys(paymentResponse.profile).length !== 0) {
            token = paymentObject.paymentInstrument.useProfile.useCustomerRefNum;
        } else if (paymentResponse.paymentInstrument.card.safetechToken) {
            token = paymentResponse.paymentInstrument.card.safetechToken;
        }
    } else {
        error = true;
        serverErrors.push('Payment Error');
        JPMCLogger.error(AuthorizeFile + ' (Authorize): Payment call errors: {0}.', serverErrors);
    }

    if (session.privacy.saveCustomerPaymentCheckbox && token && order.customer.registered && order.customer.authenticated) {
        if (paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD) {
            debundlePaymentObject = OrbitalAPIHelper.prepareDebundlePaymentObjectForGooglePay(googlePayToken);
            debundlePaymentInfo = OrbitalAPIHelper.debundlePaymentInfoForGooglePay(debundlePaymentObject);
            formData = {
                expirationMonth: { value: debundlePaymentInfo.TokenData.expirationMonth },
                expirationYear: { value: debundlePaymentInfo.TokenData.expirationYear },
                cardNumber: { value: debundlePaymentInfo.TokenData.pan },
                cardType: { value: JPMCOrbitalConstants.GOOGLE },
                googlePayToken: googlePayToken
            };
            if (preferenceHelper.getCustomerSavedPaymentType() !== JPMCOrbitalConstants.safetechToken) {
                profileAddObject = profileAddModel.getProfileAddObjectFromAccount(formData, customer.profile, JPMCOrbitalConstants.CC);
                profileAddResponse = profileServices.addProfile(profileAddObject);

                if (profileAddResponse.status === JPMCOrbitalConstants.OK) {
                    cardBrand = profileAddResponse.responseBody.paymentInstrument.card.cardBrand;
                    data = formData;
                    tokenData = profileAddResponse.responseBody.profile.customerRefNum;
                }
            } else {
                cardBrand = paymentResponse.paymentInstrument.card.cardBrand;
                data = formData;
                tokenData = token;
            }
        } else if (paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD) {
            debundlePaymentObject = OrbitalAPIHelper.prepareDebundlePaymentObjectForVisaPay(visaPay);
            debundlePaymentInfo = OrbitalAPIHelper.debundlePaymentInfoForVisaPay(debundlePaymentObject);
            formData = {
                expirationMonth: { value: debundlePaymentInfo.TokenData.expirationMonth },
                expirationYear: { value: debundlePaymentInfo.TokenData.expirationYear },
                cardNumber: { value: debundlePaymentInfo.TokenData.accountNumber },
                cardType: { value: JPMCOrbitalConstants.VISA_CHECKOUT },
                visaPay: visaPay
            };
            if (preferenceHelper.getCustomerSavedPaymentType() !== JPMCOrbitalConstants.safetechToken) {
                profileAddObject = profileAddModel.getProfileAddObjectFromAccount(formData, customer.profile, JPMCOrbitalConstants.CC);
                profileAddResponse = profileServices.addProfile(profileAddObject);

                if (profileAddResponse.status === JPMCOrbitalConstants.OK) {
                    cardBrand = profileAddResponse.responseBody.paymentInstrument.card.cardBrand;
                    data = formData;
                    tokenData = profileAddResponse.responseBody.profile.customerRefNum;
                }
            } else {
                cardBrand = paymentResponse.paymentInstrument.card.cardBrand;
                data = formData;
                tokenData = token;
            }
        } else if (paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD) {
            debundlePaymentObject = OrbitalAPIHelper.prepareDebundlePaymentObjectForApplePay(applePayToken);
            debundlePaymentInfo = OrbitalAPIHelper.debundlePaymentInfoForApplePay(debundlePaymentObject);
            formData = {
                expirationMonth: { value: +parseInt(debundlePaymentInfo.TokenData.applicationExpirationDate.slice(2, 4), 10) },
                expirationYear: { value: parseInt(JPMCOrbitalConstants.n_20 + debundlePaymentInfo.TokenData.applicationExpirationDate.slice(0, 2), 10) },
                cardNumber: { value: debundlePaymentInfo.TokenData.applicationPrimaryAccountNumber },
                cardType: { value: JPMCOrbitalConstants.APPLE },
                applePayToken: applePayToken
            };
            if (preferenceHelper.getCustomerSavedPaymentType() !== JPMCOrbitalConstants.safetechToken) {
                profileAddObject = profileAddModel.getProfileAddObjectFromAccount(formData, customer.profile, JPMCOrbitalConstants.CC);
                profileAddResponse = profileServices.addProfile(profileAddObject);

                if (profileAddResponse.status === JPMCOrbitalConstants.OK) {
                    cardBrand = profileAddResponse.responseBody.paymentInstrument.card.cardBrand;
                    data = formData;
                    tokenData = profileAddResponse.responseBody.profile.customerRefNum;
                }
            } else {
                cardBrand = paymentResponse.paymentInstrument.card.cardBrand;
                data = formData;
                tokenData = token;
            }
        } else {
            tokenData = token;
        }
        if (tokenData) {
            OrbitalAPIHelper.saveCustomerPayment(order.customerNo, paymentMethod, tokenData, data, cardBrand);
            saveProfile = true;
            session.privacy.saveCustomerPaymentCheckbox = null;
        }
    }

    if (paymentObject.avsBilling) {
        var avsObject = new AVSPaymentResponseModel(responseObject);
        if (avsObject) {
            var avsStatus = AVSPaymentResponseModel.getAVSResponseStatus();
            var avsUnacceptedValues = preferenceHelper.getAVSUnacceptedValues();
            if (!avsStatus || avsUnacceptedValues.indexOf(avsObject.avsRespCode) > -1) {
                JPMCLogger.error(AuthorizeFile + ' (Authorize): AVS Payment Status error.');
                var avsFail = HookMgr.callHook('app.orbital.avs', 'fail', responseObject);
                error = true;
                serverErrors.push('Payment Error');
                if (avsFail) {
                    return {
                        serverErrors: serverErrors,
                        error: error
                    };
                }
                if (!avsFail) {
                    error = true;
                    serverErrors.push('Payment Error');
                    JPMCLogger.error(AuthorizeFile + ' (Authorize): AVS unsuccessful reversal attempt. Server Errors: {0}.', serverErrors);
                    return {
                        serverErrors: serverErrors,
                        error: error
                    };
                }
            }
        }
    }

    try {
        Transaction.wrap(function () {
            var pInstrument = paymentInstrument;
            pInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
            if (paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD) {
                pInstrument.paymentTransaction.custom.jpmcOPaymentStatus = preferenceHelper.getPaymentModeElectronicCheck();
            } else if (paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_CARD || paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_ELECTRONIC_CHECK || paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_GOOGLE_PAY || paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_VISA_CHECKOUT || paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_APPLE_PAY) {
                pInstrument.paymentTransaction.custom.jpmcOPaymentStatus = preferenceHelper.getPaymentModeProfile();
            } else if (paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD) {
                pInstrument.paymentTransaction.custom.jpmcOPaymentStatus = preferenceHelper.getPaymentModeGooglePay();
            } else if (paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD) {
                pInstrument.paymentTransaction.custom.jpmcOPaymentStatus = preferenceHelper.getPaymentModeApplePay();
            } else if (paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD) {
                pInstrument.paymentTransaction.custom.jpmcOPaymentStatus = preferenceHelper.getPaymentModeCard();
            } else if (paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD) {
                pInstrument.paymentTransaction.custom.jpmcOPaymentStatus = preferenceHelper.getPaymentModeVisaPay();
            }

            if (paymentMethod !== JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_CARD && paymentMethod !== JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_ELECTRONIC_CHECK && paymentMethod !== JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_GOOGLE_PAY && !session.privacy.profile_visa && paymentMethod !== JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_APPLE_PAY) {
                if (token) {
                    pInstrument.setCreditCardToken(token);
                }
                pInstrument.paymentTransaction.custom.jpmcOPaymentSavedProfile = saveProfile;
            } else {
                pInstrument.paymentTransaction.custom.jpmcOPaymentSavedProfile = true;
            }

            if (paymentResponse && !error) {
                if (responseObject.transType === JPMCOrbitalConstants.AuthorizationAndCapture) {
                    var amountPaid = order.getTotalGrossPrice();
                    pInstrument.paymentTransaction.setAmount(amountPaid);
                    pInstrument.paymentTransaction.setType(PaymentTransaction.TYPE_CAPTURE);
                } else if (responseObject.transType === JPMCOrbitalConstants.Authorization) {
                    pInstrument.paymentTransaction.setType(PaymentTransaction.TYPE_AUTH);
                }
                error = empty(paymentResponse);
                var statusMessage = responseObject.getStatusMessage();
                // Set payment response object to transaction
                // Setting the OMS Variable
                if (paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD || paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_ELECTRONIC_CHECK) {
                    pInstrument.paymentTransaction.custom.jpmcpg__ecpCheckDDA = session.privacy.ecpCheckDDA;
                    pInstrument.paymentTransaction.custom.jpmcpg__ecpCheckRT = session.privacy.ecpCheckRT;
                    session.privacy.ecpCheckDDA = null;
                    session.privacy.ecpCheckRT = null;
                }
                if (paymentObject.avsBilling) {
                    var avsTransactionObject = new AVSPaymentResponseModel(responseObject);
                    if (avsTransactionObject) {
                        pInstrument.paymentTransaction.custom.jpmcOAVSObject = JSON.stringify(avsTransactionObject);
                    }
                }
                pInstrument.paymentTransaction.custom.jpmcpg__OrbitalResponseMessage = order.currencyCode + '|' + JSON.stringify(paymentResponse);
                pInstrument.paymentTransaction.custom.jpmcORetryTrace = responseObject.order.retryTrace;
                // remove paymentInstruments in order to sanitize response record.
                delete paymentResponse.paymentInstrument;
                var txRefNum = responseObject.getTxRefNum(paymentResponse);
                if (txRefNum) {
                    pInstrument.paymentTransaction.transactionID = txRefNum;
                    JPMCLogger.info(AuthorizeFile + ' (Authorize): txRefNum is assigned as transactionID: {0}', txRefNum);
                }
                if (responseObject.transType === JPMCOrbitalConstants.AuthorizationAndCapture) {
                    order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
                } else {
                    order.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
                }
                if (paymentResponse) {
                    order.addNote(JPMCOrbitalConstants.JPMC, (JPMCOrbitalConstants.Status_Message + statusMessage + JPMCOrbitalConstants.TxRefNumber + txRefNum));
                }
            } else {
                error = true;
                serverErrors.push('Payment Error');
                JPMCLogger.error(AuthorizeFile + ' (Authorize): Payment error. Server Errors: {0}.', serverErrors);
            }
        });
    } catch (e) {
        serverErrors.push('Payment Error');
        JPMCLogger.error(AuthorizeFile + ' (Authorize): Payment error: ', e.message + '; ' + e.fileName + ' ' + e.lineNumber);
    }

    return {
        serverErrors: serverErrors,
        error: error
    };
}
module.exports = {
    getHandleTransaction: getHandleTransaction,
    getAuthorize: getAuthorize
};
