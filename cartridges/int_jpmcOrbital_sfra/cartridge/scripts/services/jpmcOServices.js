var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var preferenceHelper = require('*/cartridge/scripts/helpers/preferenceHelper');
var JPMCLogger = require('dw/system/Logger').getLogger('JPMCLogger', 'JPMCLogger');
var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');

 /**
 * JPMC Payment Service
 */
function JpmcService() {
    this.service = LocalServiceRegistry.createService('JPMC.OrbitalAPI.payment.http.service', {
        createRequest: function (svc, args) {
            var svcRef = svc;
            var apiCredentials = preferenceHelper.getApiCredentials(args.locale);
            var jpmcOAPIUser = apiCredentials.orbitalUsername;
            var jpmcOAPISecret = apiCredentials.orbitalPassword;
            var merchantID = apiCredentials.orbitalMerchantID;

            svcRef.addHeader('OrbitalConnectionUsername', jpmcOAPIUser);
            svcRef.addHeader('OrbitalConnectionPassword', jpmcOAPISecret);
            svcRef.addHeader('MerchantID', merchantID);
            svcRef.setRequestMethod(args.req);
            svcRef.URL = svc.getConfiguration().getCredential().getURL() + args.urlPart;
            svcRef.addHeader('Content-Type', args.contentType);
            return args.data;
        },
        parseResponse: function (svc, client) {
            return JSON.parse(client.text);
        },
        filterLogMessage: function (msg) {
            return msg;
        }
    });

    this.service2 = LocalServiceRegistry.createService('JPMC.OrbitalAPI2.payment.http.service', {
        createRequest: function (svc, args) {
            var svcRef = svc;
            var apiCredentials = preferenceHelper.getApiCredentials(args.locale);
            var jpmcOAPIUser = apiCredentials.orbitalUsername;
            var jpmcOAPISecret = apiCredentials.orbitalPassword;
            var merchantID = apiCredentials.orbitalMerchantID;

            svcRef.addHeader('OrbitalConnectionUsername', jpmcOAPIUser);
            svcRef.addHeader('OrbitalConnectionPassword', jpmcOAPISecret);
            svcRef.addHeader('MerchantID', merchantID);
            svcRef.setRequestMethod(args.req);
            svcRef.URL = svc.getConfiguration().getCredential().getURL() + args.urlPart;
            svcRef.addHeader('Content-Type', args.contentType);
            return args.data;
        },
        parseResponse: function (svc, client) {
            return JSON.parse(client.text);
        },
        filterLogMessage: function (msg) {
            return msg;
        }
    });

    this.exec = function (args) {
        var result = this.service.call(args);
        if (result.status === 'ERROR') {
            result = this.service2.call(args);
            if (result.status === 'ERROR') {
                session.privacy.jpmcErrorMessage = result.errorMessage;
                JPMCLogger.error('orbitalCSCServices.js (JpmcPayment): JPMC payment service call errors: {0}.', result.errorMessage);
            } else if (result.status === JPMCOrbitalConstants.OK) {
                if (result.object && result.object.order && result.object.order.status.respCode) {
                    var approvedRespCodes2 = JPMCOrbitalConstants.approvedRespCodes;
                    var resendableRespCodes2 = JPMCOrbitalConstants.resendableRespCodes;
                    if (approvedRespCodes2.indexOf(result.object.order.status.respCode) > -1) {
                        return result;
                    }
                    if (resendableRespCodes2.indexOf(result.object.order.status.respCode) > -1) {
                        result = this.service2.call(args);
                        return result;
                    }
                    if (!(approvedRespCodes2.indexOf(result.object.order.status.respCode) > -1) || !(resendableRespCodes2.indexOf(result.object.order.status.respCode) > -1)) {
                        result = this.service2.call(args);
                        if (!(approvedRespCodes2.indexOf(result.object.order.status.respCode) > -1) || !(resendableRespCodes2.indexOf(result.object.order.status.respCode) > -1)) {
                            var errorRespCode2 = {
                                errorMessage: result.object.order.status.procStatusMessage
                            };

                            return errorRespCode2;
                        }
                    }
                } else if (result.object && result.object.order && result.object.order.status.hostRespCode) {
                    var platformMode2 = preferenceHelper.getPaymentPlatformMode();
                    if (platformMode2 === JPMCOrbitalConstants.stratus) {
                        var approvedHostRespCodesStratus2 = JPMCOrbitalConstants.approvedHostRespCodesStratus;
                        var resendHostRespCodesStratus2 = JPMCOrbitalConstants.resendHostRespCodesStratus;
                        if (approvedHostRespCodesStratus2.indexOf(result.object.order.status.hostRespCode) > -1) {
                            return result;
                        }
                        if (resendHostRespCodesStratus2.indexOf(result.object.order.status.hostRespCode) > -1) {
                            result = this.service2.call(args);
                            return result;
                        }
                        if (!(approvedHostRespCodesStratus2.indexOf(result.object.order.status.hostRespCode) > -1) || !(resendHostRespCodesStratus2.indexOf(result.object.order.status.hostRespCode) > -1)) {
                            result = this.service2.call(args);
                            if (!(approvedHostRespCodesStratus2.indexOf(result.object.order.status.hostRespCode) > -1) || !(resendHostRespCodesStratus2.indexOf(result.object.order.status.hostRespCode) > -1)) {
                                var errorHostRespCode2 = {
                                    errorMessage: result.object.order.status.procStatusMessage
                                };

                                return errorHostRespCode2;
                            }
                        }
                    } else if (platformMode2 === JPMCOrbitalConstants.tandem) {
                        var approvedHostRespCodesTandem2 = JPMCOrbitalConstants.approvedHostRespCodesTandem;
                        var resendHostRespCodesTandem2 = JPMCOrbitalConstants.resendHostRespCodesTandem;
                        if (approvedHostRespCodesTandem2.indexOf(result.object.order.status.hostRespCode) > -1) {
                            return result;
                        }
                        if (resendHostRespCodesTandem2.indexOf(result.object.order.status.hostRespCode) > -1) {
                            result = this.service2.call(args);
                            return result;
                        }
                        if (!(approvedHostRespCodesTandem2.indexOf(result.object.order.status.hostRespCode) > -1) || !(resendHostRespCodesTandem2.indexOf(result.object.order.status.hostRespCode) > -1)) {
                            result = this.service2.call(args);
                            if (!(approvedHostRespCodesTandem2.indexOf(result.object.order.status.hostRespCode) > -1) || !(resendHostRespCodesTandem2.indexOf(result.object.order.status.hostRespCode) > -1)) {
                                var errorTandemHostRespCode2 = {
                                    errorMessage: result.object.order.status.procStatusMessage
                                };

                                return errorTandemHostRespCode2;
                            }
                        }
                    }
                } else if (result.object && result.object.order && result.object.order.status.procStatus) {
                    var approvedProcStatusCodes2 = JPMCOrbitalConstants.approvedProcStatusCodes;
                    var resendableProcStatusCodes2 = JPMCOrbitalConstants.resendableProcStatusCodes;
                    if (approvedProcStatusCodes2.indexOf(result.object.order.status.procStatus) > -1) {
                        return result;
                    }
                    if (resendableProcStatusCodes2.indexOf(result.object.order.status.procStatus) > -1) {
                        result = this.service2.call(args);
                        return result;
                    }
                    if (!(approvedProcStatusCodes2.indexOf(result.object.order.status.procStatus) > -1) || !(resendableProcStatusCodes2.indexOf(result.object.order.status.procStatus) > -1)) {
                        result = this.service2.call(args);
                        if (!(approvedProcStatusCodes2.indexOf(result.object.order.status.procStatus) > -1) || !(resendableProcStatusCodes2.indexOf(result.object.order.status.procStatus) > -1)) {
                            var errorProcStatus2 = {
                                errorMessage: result.object.order.status.procStatusMessage
                            };

                            return errorProcStatus2;
                        }
                    }
                }
            }
        } else if (result.status === JPMCOrbitalConstants.OK) {
            if (result.object && result.object.order && result.object.order.status.respCode) {
                var approvedRespCodes = JPMCOrbitalConstants.approvedRespCodes;
                var resendableRespCodes = JPMCOrbitalConstants.resendableRespCodes;
                if (approvedRespCodes.indexOf(result.object.order.status.respCode) > -1) {
                    return result;
                }
                if (resendableRespCodes.indexOf(result.object.order.status.respCode) > -1) {
                    result = this.service.call(args);
                    return result;
                }
                if (!(approvedRespCodes.indexOf(result.object.order.status.respCode) > -1) || !(resendableRespCodes.indexOf(result.object.order.status.respCode) > -1)) {
                    result = this.service2.call(args);
                    if (!(approvedRespCodes.indexOf(result.object.order.status.respCode) > -1) || !(resendableRespCodes.indexOf(result.object.order.status.respCode) > -1)) {
                        var errorRespCode = {
                            errorMessage: result.object.order.status.procStatusMessage
                        };

                        return errorRespCode;
                    }
                    if (approvedRespCodes.indexOf(result.object.order.status.respCode) > -1) {
                        return result;
                    }
                    if (resendableRespCodes.indexOf(result.object.order.status.respCode) > -1) {
                        result = this.service.call(args);
                        return result;
                    }
                }
            } else if (result.object && result.object.order && result.object.order.status.hostRespCode) {
                var platformMode = preferenceHelper.getPaymentPlatformMode();
                if (platformMode === JPMCOrbitalConstants.stratus) {
                    var approvedHostRespCodesStratus = JPMCOrbitalConstants.approvedHostRespCodesStratus;
                    var resendHostRespCodesStratus = JPMCOrbitalConstants.resendHostRespCodesStratus;
                    if (approvedHostRespCodesStratus.indexOf(result.object.order.status.hostRespCode) > -1) {
                        return result;
                    }
                    if (resendHostRespCodesStratus.indexOf(result.object.order.status.hostRespCode) > -1) {
                        result = this.service.call(args);
                        return result;
                    }
                    if (!(approvedHostRespCodesStratus.indexOf(result.object.order.status.hostRespCode) > -1) || !(resendHostRespCodesStratus.indexOf(result.object.order.status.hostRespCode) > -1)) {
                        result = this.service2.call(args);
                        if (!(approvedHostRespCodesStratus.indexOf(result.object.order.status.hostRespCode) > -1) || !(resendHostRespCodesStratus.indexOf(result.object.order.status.hostRespCode) > -1)) {
                            var errorHostRespCode = {
                                errorMessage: result.object.order.status.procStatusMessage
                            };

                            return errorHostRespCode;
                        }
                        if (approvedHostRespCodesStratus.indexOf(result.object.order.status.hostRespCode) > -1) {
                            return result;
                        }
                        if (resendHostRespCodesStratus.indexOf(result.object.order.status.hostRespCode) > -1) {
                            result = this.service.call(args);
                            return result;
                        }
                    }
                } else if (platformMode === JPMCOrbitalConstants.tandem) {
                    var approvedHostRespCodesTandem = JPMCOrbitalConstants.approvedHostRespCodesTandem;
                    var resendHostRespCodesTandem = JPMCOrbitalConstants.resendHostRespCodesTandem;
                    if (approvedHostRespCodesTandem.indexOf(result.object.order.status.hostRespCode) > -1) {
                        return result;
                    }
                    if (resendHostRespCodesTandem.indexOf(result.object.order.status.hostRespCode) > -1) {
                        result = this.service.call(args);
                        return result;
                    }
                    if (!(approvedHostRespCodesTandem.indexOf(result.object.order.status.hostRespCode) > -1) || !(resendHostRespCodesTandem.indexOf(result.object.order.status.hostRespCode) > -1)) {
                        result = this.service2.call(args);
                        if (!(approvedHostRespCodesTandem.indexOf(result.object.order.status.hostRespCode) > -1) || !(resendHostRespCodesTandem.indexOf(result.object.order.status.hostRespCode) > -1)) {
                            var errorTandemHostRespCode = {
                                errorMessage: result.object.order.status.procStatusMessage
                            };

                            return errorTandemHostRespCode;
                        }
                        if (approvedHostRespCodesTandem.indexOf(result.object.order.status.hostRespCode) > -1) {
                            return result;
                        }
                        if (resendHostRespCodesTandem.indexOf(result.object.order.status.hostRespCode) > -1) {
                            result = this.service.call(args);
                            return result;
                        }
                    }
                }
            } else if (result.object && result.object.order && result.object.order.status.procStatus) {
                var approvedProcStatusCodes = JPMCOrbitalConstants.approvedProcStatusCodes;
                var resendableProcStatusCodes = JPMCOrbitalConstants.resendableProcStatusCodes;
                if (approvedProcStatusCodes.indexOf(result.object.order.status.procStatus) > -1) {
                    return result;
                }
                if (resendableProcStatusCodes.indexOf(result.object.order.status.procStatus) > -1) {
                    result = this.service.call(args);
                    return result;
                }
                if (!(approvedProcStatusCodes.indexOf(result.object.order.status.procStatus) > -1) || !(resendableProcStatusCodes.indexOf(result.object.order.status.procStatus) > -1)) {
                    result = this.service2.call(args);
                    if (!(approvedProcStatusCodes.indexOf(result.object.order.status.procStatus) > -1) || !(resendableProcStatusCodes.indexOf(result.object.order.status.procStatus) > -1)) {
                        var errorProcStatus = {
                            errorMessage: result.object.order.status.procStatusMessage
                        };

                        return errorProcStatus;
                    }
                    if (approvedProcStatusCodes.indexOf(result.object.order.status.procStatus) > -1) {
                        return result;
                    }
                    if (resendableProcStatusCodes.indexOf(result.object.order.status.procStatus) > -1) {
                        result = this.service.call(args);
                        return result;
                    }
                }
            }
        }
        return result;
    };

    this.post = function (urlPart, data, contentType, locale) {
        return this.exec({
            urlPart: urlPart,
            req: 'POST',
            data: JSON.stringify(data),
            contentType: contentType,
            locale: locale
        });
    };


    this.put = function (urlPart, data, contentType) {
        return this.exec({
            urlPart: urlPart,
            req: 'PUT',
            data: JSON.stringify(data),
            contentType: contentType
        });
    };

    this.del = function (urlPart, data, contentType) {
        return this.exec({
            urlPart: urlPart,
            req: 'DELETE',
            data: JSON.stringify(data),
            contentType: contentType
        });
    };

    this.get = function (urlPart, contentType) {
        return this.exec({
            urlPart: urlPart,
            req: 'GET',
            contentType: contentType
        });
    };
}

 /**
  * @description Used to reverse a previous transaction, partially or in full.
  * @param {Object} jpmcOPaymentTransactionResponse body response
  * @param {*} onlineReversalInd onlineReversalInd
  * @param {*} locale locale
  * @param {*} transactionID transactionID
  * @return {Object} response
  */
JpmcService.prototype.reversal = function (jpmcOPaymentTransactionResponse, onlineReversalInd, locale, transactionID) {
    var reversalModel = require('*/cartridge/models/jpmcCSCModels/reversalModel');
    var reversalResponseModel = require('*/cartridge/models/jpmcCSCModels/reversalResponseModel');
    var body = reversalModel.getReversalObject(jpmcOPaymentTransactionResponse, onlineReversalInd, transactionID);
    var response = this.post('gwapi/v4/gateway/reversal/', body, 'application/json', locale);
    var responseBody = reversalResponseModel.setReversalResponseObject(response.object);
    return {
        responseBody: responseBody,
        status: response.status,
        errorMessage: response.errorMessage
    };
};

 /**
  * Used to capture a pre-auth for split shipment and settlement.
  * @param {Object} jpmcOPaymentTransactionResponse body response
  * @param {string} amount amount
  * @param {*} locale locale
  * @param {*} transactionID transactionID
  * @return {Object} response
  */
JpmcService.prototype.capture = function (jpmcOPaymentTransactionResponse, amount, locale, transactionID) {
    var captureModel = require('*/cartridge/models/jpmcCSCModels/captureModel');
    var captureResponseModel = require('*/cartridge/models/jpmcCSCModels/captureResponseModel');
    var body = captureModel.getCaptureObject(jpmcOPaymentTransactionResponse, amount, transactionID);
    var response = this.post('gwapi/v4/gateway/capture/', body, 'application/json', locale);
    var responseBody = captureResponseModel.setCaptureResponseObject(response.object);
    return {
        responseBody: responseBody,
        status: response.status,
        errorMessage: response.errorMessage
    };
};

/**
  * Used to perform a refund transaction.
  * @param {Object} jpmcOPaymentTransactionResponse body response
  * @param {*} amount amount
  * @param {*} locale locale
  * @param {*} transactionID transactionID
  * @return {Object} response
  */
JpmcService.prototype.refund = function (jpmcOPaymentTransactionResponse, amount, locale, transactionID) {
    var refundModel = require('*/cartridge/models/jpmcCSCModels/refundModel');
    var refundResponseModel = require('*/cartridge/models/jpmcCSCModels/refundResponseModel');
    var body = refundModel.getRefundObject(jpmcOPaymentTransactionResponse, amount, transactionID);
    var response = this.post('gwapi/v4/gateway/refund/', body, 'application/json', locale);
    var responseBody = refundResponseModel.setRefundResponseObject(response.object);
    return {
        responseBody: responseBody,
        status: response.status,
        errorMessage: response.errorMessage
    };
};

/**
  * Used to obtain response details of a transaction that has already been performed.
  * @param {Object} jpmcOPaymentTransactionResponse body response
  * @param {string} retryTrace retryTrace
  * @param {*} locale locale
  * @return {Object} response
  */
JpmcService.prototype.inquiry = function (jpmcOPaymentTransactionResponse, retryTrace, locale) {
    var inquiryModel = require('*/cartridge/models/jpmcCSCModels/inquiryModel');
    var inquiryResponseModel = require('*/cartridge/models/jpmcCSCModels/inquiryResponseModel');
    var body = inquiryModel.getInquiryObject(jpmcOPaymentTransactionResponse, retryTrace);
    var response = this.post('gwapi/v4/gateway/inquiry/', body, 'application/json', locale);
    var responseBody = inquiryResponseModel.setInquiryResponseObject(response.object);
    return {
        responseBody: responseBody,
        status: response.status,
        errorMessage: response.errorMessage
    };
};


/**
  * @description Used to create a profile.
  * @param {Object} body body
  * @return {Object} response
  */
JpmcService.prototype.addProfile = function (body) {
    var response = this.post('gwapi/v4/gateway/profile/', body, 'application/json');
    var profileResponseModel = require('*/cartridge/models/jpmcModels/jpmcProfileResponseModel');
    var responseBody = profileResponseModel.setProfileResponseObject(response.object);
    return {
        responseBody: responseBody,
        status: response.status,
        errorMessage: response.errorMessage
    };
};

/**
  * @description Used to update a profile.
  * @param {Object} body body
  * @return {Object} response
  */
JpmcService.prototype.updateProfile = function (body) {
    var response = this.put('gwapi/v4/gateway/profile/', body, 'application/json');
    var profileResponseModel = require('*/cartridge/models/jpmcModels/jpmcProfileResponseModel');
    var responseBody = profileResponseModel.setProfileResponseObject(response.object);
    return {
        responseBody: responseBody,
        status: response.status,
        errorMessage: response.errorMessage
    };
};

/**
  * @description Used to delete a profile.
  * @param {Object} body body
  * @return {Object} response
  */
JpmcService.prototype.deleteProfile = function (body) {
    var response = this.del('gwapi/v4/gateway/profile/', body, 'application/json');
    var profileResponseModel = require('*/cartridge/models/jpmcModels/jpmcProfileResponseModel');
    var responseBody = profileResponseModel.setProfileResponseObject(response.object);
    return {
        responseBody: responseBody,
        status: response.status,
        errorMessage: response.errorMessage
    };
};

/**
  * @description Returns a tokenized vesion of the card number sent in the request
  * @param {Object} body body
  * @return {Object} response
  */
JpmcService.prototype.getToken = function (body) {
    var response = this.post('gwapi/v4/gateway/token/', body, 'application/json');
    var tokenResponseModel = require('*/cartridge/models/jpmcModels/jpmcTokenResponseModel');
    var responseBody = tokenResponseModel.setTokenResponseObject(response.object);
    return {
        responseBody: responseBody,
        status: response.status,
        errorMessage: response.errorMessage
    };
};

/**
  * @description Used to perform a new authorization, authorization and capture, or force capture transaction.
  * @param {Object} body body
  * @param {*} locale locale
  * @return {Object} response
  */
JpmcService.prototype.payments = function (body, locale) {
    var response = this.post('gwapi/v4/gateway/payments/', body, 'application/json', locale);
    return {
        responseBody: response.object,
        status: response.status,
        errorMessage: response.errorMessage
    };
};

/**
  * @description Used to debundle payment information from token
  * @param {Object} body body
  * @return {Object} response
  */
JpmcService.prototype.debundle = function (body) {
    var response = this.post('gwapi/v4/gateway/debundle/api', body, 'application/json');
    return {
        responseBody: response.object,
        status: response.status,
        errorMessage: response.errorMessage
    };
};

/**
 * retrieveProfileDetails
 * @param {*} customerrefnum token
 * @return {Object} response
 */
JpmcService.prototype.retrieveProfileDetails = function (customerrefnum) {
    var bin = preferenceHelper.getPaymentPlatformMode();
    var response = this.get('gwapi/v4/gateway/profile/version/4.5/bin/' + bin + '/customerrefnum/' + customerrefnum, 'application/json');
    return {
        responseBody: response.object,
        status: response.status,
        errorMessage: response.errorMessage
    };
};

module.exports = JpmcService;
