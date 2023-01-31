var LocalServiceRegistry = {

    createService: function () {
        this.URL = '';
        this.headers = {};
        this.requestMethod = '';

        this.setRequestMethod = function (method) {
            this.requestMethod = method;
        };

        this.addHeader = function (headerName, headerType) {
            this.headers[headerName] = headerType;
        };

        return {
            headers: this.headers,
            URL: this.URL,
            setRequestMethod: this.setRequestMethod,
            addHeader: this.addHeader,
            getConfiguration: this.getConfiguration,
            setCredentialID: function (params) {
                return {
                    credentialId: params
                };
            },
            call: function () {
                return {
                    error: 0,
                    errorMessage: null,
                    mockResult: false,
                    msg: 'OK',
                    object: {
                        merchant: {
                            bin: '000001'
                        },
                        order: {
                            orderDefaultAmount: '10000'
                        },
                        paymentInstrument: {
                            card: {},
                            ecp: {}
                        },
                        TokenData: {
                            expirationYear: '2022',
                            expirationMonth: '1'
                        }
                    }
                };
            }
        };
    }
};
var preferenceHelper = require('../mocks/preferenceHelperMocks.test');
var JPMCOrbitalConstants = require('../../test/mocks/jpmcOConstantsHelperMocks.test');
var JPMCLogger = {
    getLogger: function () {
        return '';
    }
};

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
            svcRef.URL = 'https://orbitalvar1.chasepaymentech.com/' + args.urlPart;
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
            session.privacy.jpmcErrorMessage = result.errorMessage;
            JPMCLogger.error('orbitalCSCServices.js (JpmcPayment): JPMC payment service call errors: {0}.', result.errorMessage);
        } else if (result.status === JPMCOrbitalConstants.OK) {
            if (result.object && result.object.order && result.object.order.status.respCode) {
                var approvedRespCodes = ['00', '0', '8', '11', '24', '26', '27', '28', '29', '31', '32', '34', '91', '92',
                    '93', '94', 'E7', 'P1', 'PA'];
                var resendableRespCodes = ['19', '98', '99', 'L2'];
                if (approvedRespCodes.indexOf(result.object.order.status.respCode) > -1) {
                    return result;
                }
                if (resendableRespCodes.indexOf(result.object.order.status.respCode) > -1) {
                    result = this.service.call(args);
                    return result;
                }
                if (!(approvedRespCodes.indexOf(result.object.order.status.respCode) > -1) || !(resendableRespCodes.indexOf(result.object.order.status.respCode) > -1)) {
                    var errorRespCode = {
                        errorMessage: result.object.order.status.procStatusMessage
                    };

                    return errorRespCode;
                }
            } else if (result.object && result.object.order && result.object.order.status.hostRespCode) {
                var platformMode = preferenceHelper.getPaymentPlatformMode();
                if (platformMode === JPMCOrbitalConstants.stratus) {
                    var approvedHostRespCodesStratus = ['100', '101', '102', '103', '104', '105', '106', '107', '110', '111',
                        '112', '113', '114', '115', '704', '119'];
                    var resendHostRespCodesStratus = ['301', '0', '902'];
                    if (approvedHostRespCodesStratus.indexOf(result.object.order.status.hostRespCode) > -1) {
                        return result;
                    }
                    if (resendHostRespCodesStratus.indexOf(result.object.order.status.hostRespCode) > -1) {
                        result = this.service.call(args);
                        return result;
                    }
                    if (!(approvedHostRespCodesStratus.indexOf(result.object.order.status.hostRespCode) > -1) || !(resendHostRespCodesStratus.indexOf(result.object.order.status.hostRespCode) > -1)) {
                        var errorHostRespCode = {
                            errorMessage: result.object.order.status.procStatusMessage
                        };

                        return errorHostRespCode;
                    }
                } else if (platformMode === JPMCOrbitalConstants.tandem) {
                    var approvedHostRespCodesTandem = ['00', '100', '102', '8', '11', '101', '103', '10'];
                    var resendHostRespCodesTandem = ['19', '99'];
                    if (approvedHostRespCodesTandem.indexOf(result.object.order.status.hostRespCode) > -1) {
                        return result;
                    }
                    if (resendHostRespCodesTandem.indexOf(result.object.order.status.hostRespCode) > -1) {
                        result = this.service.call(args);
                        return result;
                    }
                    if (!(approvedHostRespCodesTandem.indexOf(result.object.order.status.hostRespCode) > -1) || !(resendHostRespCodesTandem.indexOf(result.object.order.status.hostRespCode) > -1)) {
                        var errorTandemHostRespCode = {
                            errorMessage: result.object.order.status.procStatusMessage
                        };

                        return errorTandemHostRespCode;
                    }
                }
            } else if (result.object && result.object.order && result.object.order.status.procStatus) {
                var approvedProcStatusCodes = ['0', '1019', '3002', '3007', '4004', '4009', '6004', '7000'];
                var resendableProcStatusCodes = ['1', '2', '3', '6', '14', '24', '26', '29', '30', '40', '47', '49', '50',
                    '51', '201', '202', '203', '204', '205', '207', '208', '209', '210', '301', '302', '303', '304',
                    '310', '311', '312', '313', '314', '315', '343', '345', '410', '411', '920', '921', '1002', '1009',
                    '2002', '3004', '3005', '3016', '4006', '7002', '8001', '9736', '9737', '9738', '9759', '9990', '9991', '9992',
                    '9993', '9999', '10011', '10138', '10144', '19772', '9710', '9711', '9737'];
                if (approvedProcStatusCodes.indexOf(result.object.order.status.procStatus) > -1) {
                    return result;
                }
                if (resendableProcStatusCodes.indexOf(result.object.order.status.procStatus) > -1) {
                    result = this.service.call(args);
                    return result;
                }
                if (!(approvedProcStatusCodes.indexOf(result.object.order.status.procStatus) > -1) || !(resendableProcStatusCodes.indexOf(result.object.order.status.procStatus) > -1)) {
                    var errorProcStatus = {
                        errorMessage: result.object.order.status.procStatusMessage
                    };

                    return errorProcStatus;
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
  * @param {*} amount amount
  * @param {*} onlineReversalInd onlineReversalInd
  * @param {*} locale locale
  * @param {*} transactionID transactionID
  * @return {Object} response
  */
JpmcService.prototype.reversal = function (jpmcOPaymentTransactionResponse, amount, onlineReversalInd, locale, transactionID) {
    var reversalModel = require('../mocks/jpmcCSCModelsMocks/reversalModelMock.test');
    var reversalResponseModel = require('../mocks/jpmcCSCModelsMocks/reversalResponseModelMock.test');
    var body = reversalModel.getReversalObject(jpmcOPaymentTransactionResponse, amount, onlineReversalInd, transactionID);
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
    var captureModel = require('../mocks/jpmcCSCModelsMocks/captureModelMock.test');
    var captureResponseModel = require('../mocks/jpmcCSCModelsMocks/captureResponseModelMock.test');
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
    var refundModel = require('../mocks/jpmcCSCModelsMocks/refundModelMock.test');
    var refundResponseModel = require('../mocks/jpmcCSCModelsMocks/refundResponseModelMock.test');
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
  * @param {*} locale locale
  * @return {Object} response
  */
JpmcService.prototype.inquiry = function (jpmcOPaymentTransactionResponse, locale) {
    var inquiryModel = require('../mocks/jpmcCSCModelsMocks/inquiryModelMock.test');
    var inquiryResponseModel = require('../mocks/jpmcCSCModelsMocks/inquiryResponseModelMock.test');
    var body = inquiryModel.getInquiryObject(jpmcOPaymentTransactionResponse);
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
    var profileResponseModel = require('../mocks/jpmcModelsMocks/jpmcProfileResponseModelMock.test');
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
    var profileResponseModel = require('../mocks/jpmcModelsMocks/jpmcProfileResponseModelMock.test');
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
    var response = this.put('gwapi/v4/gateway/profile/', body, 'application/json');
    var profileResponseModel = require('../mocks/jpmcModelsMocks/jpmcProfileResponseModelMock.test');
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
    var tokenResponseModel = require('../mocks/jpmcModelsMocks/jpmcTokenResponseModelMock.test');
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
