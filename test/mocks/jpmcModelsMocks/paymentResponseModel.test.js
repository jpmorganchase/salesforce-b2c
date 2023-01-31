/**
 * @desc Payment Response Model instead of populated it, using functions to partially get what needed.
 * @param {Object} paymentResponseObject paymentResponseObject
 */
 function PaymentResponseModel(paymentResponseObject) {
     if (paymentResponseObject.version) {
         this.version = paymentResponseObject.version;
     }
     if (paymentResponseObject.transType) {
         this.transType = paymentResponseObject.transType;
     }
     if (paymentResponseObject.merchant) {
         var merchant = {};
         if (paymentResponseObject.merchant.bin) {
             merchant.bin = paymentResponseObject.merchant.bin;
         }
         if (paymentResponseObject.merchant.merchantID) {
             merchant.merchantID = paymentResponseObject.merchant.merchantID;
         }
         if (paymentResponseObject.merchant.terminalID) {
             merchant.terminalID = paymentResponseObject.merchant.terminalID;
         }
         this.merchant = merchant;
     }
     if (paymentResponseObject.paymentInstrument) {
         var paymentInstrument = {};
         if (paymentResponseObject.paymentInstrument.card && Object.keys(paymentResponseObject.paymentInstrument.card).length !== 0) {
             paymentInstrument.card = paymentResponseObject.paymentInstrument.card;
         }
         if (paymentResponseObject.paymentInstrument.useProfile && Object.keys(paymentResponseObject.paymentInstrument.useProfile).length !== 0) {
             paymentInstrument.useProfile = paymentResponseObject.paymentInstrument.useProfile;
         }
         if (paymentResponseObject.paymentInstrument.ecp && Object.keys(paymentResponseObject.paymentInstrument.ecp).length !== 0) {
             paymentInstrument.ecp = paymentResponseObject.paymentInstrument.ecp;
         }
         if (paymentResponseObject.paymentInstrument.customerAccountType) {
             paymentInstrument.customerAccountType = paymentResponseObject.paymentInstrument.customerAccountType ? paymentResponseObject.paymentInstrument.customerAccountType : '';
         }
         this.paymentInstrument = paymentInstrument;
     }
     if (paymentResponseObject.order) {
         this.order = {
             orderID: paymentResponseObject.order.orderID ? paymentResponseObject.order.orderID : '',
             retryTrace: paymentResponseObject.order.retryTrace ? paymentResponseObject.order.retryTrace : '',
             txRefNum: paymentResponseObject.order.txRefNum ? paymentResponseObject.order.txRefNum : '',
             txRefIdx: paymentResponseObject.order.txRefIdx ? paymentResponseObject.order.txRefIdx : '',
             respDateTime: paymentResponseObject.order.respDateTime ? paymentResponseObject.order.respDateTime : '',
             orderDefaultAmount: paymentResponseObject.order.orderDefaultAmount ? paymentResponseObject.order.orderDefaultAmount : ''
         };
         if (paymentResponseObject.order.status) {
             var status = {
                 procStatus: paymentResponseObject.order.status.procStatus ? paymentResponseObject.order.status.procStatus : '',
                 procStatusMessage: paymentResponseObject.order.status.procStatusMessage ? paymentResponseObject.order.status.procStatusMessage : '',
                 hostRespCode: paymentResponseObject.order.status.hostRespCode ? paymentResponseObject.order.status.hostRespCode : '',
                 respCode: paymentResponseObject.order.status.respCode ? paymentResponseObject.order.status.respCode : '',
                 approvalStatus: paymentResponseObject.order.status.approvalStatus ? paymentResponseObject.order.status.approvalStatus : '',
                 authorizationCode: paymentResponseObject.order.status.authorizationCode ? paymentResponseObject.order.status.authorizationCode : '',
                 pymtBrandAuthResponseCode: paymentResponseObject.order.status.pymtBrandAuthResponseCode ? paymentResponseObject.order.status.pymtBrandAuthResponseCode : '',
                 pymtBrandResponseCodeCategory: paymentResponseObject.order.status.pymtBrandResponseCodeCategory ? paymentResponseObject.order.status.pymtBrandResponseCodeCategory : ''
             };
             this.order.status = status;
         }
     }
     if (paymentResponseObject.profile) {
         this.profile = {
             customerRefNum: paymentResponseObject.profile.customerRefNum ? paymentResponseObject.profile.customerRefNum : '',
             profileOrderOverideInd: paymentResponseObject.profile.profileOrderOverideInd ? paymentResponseObject.profile.profileOrderOverideInd : '',
             customerName: paymentResponseObject.profile.customerName ? paymentResponseObject.profile.customerName : '',
             customerEmail: paymentResponseObject.profile.customerEmail ? paymentResponseObject.profile.customerEmail : '',
             customerPhone: paymentResponseObject.profile.customerPhone ? paymentResponseObject.profile.customerPhone : '',
             accountUpdaterEligibility: paymentResponseObject.profile.accountUpdaterEligibility ? paymentResponseObject.profile.accountUpdaterEligibility : '',
             profileAction: paymentResponseObject.profile.profileAction ? paymentResponseObject.profile.profileAction : '',
             customerAddress1: paymentResponseObject.profile.customerAddress1 ? paymentResponseObject.profile.customerAddress1 : '',
             customerCity: paymentResponseObject.profile.customerCity ? paymentResponseObject.profile.customerCity : '',
             customerState: paymentResponseObject.profile.customerState ? paymentResponseObject.profile.customerState : '',
             customerZIP: paymentResponseObject.profile.customerZIP ? paymentResponseObject.profile.customerZIP : '',
             customerCountryCode: paymentResponseObject.profile.customerCountryCode ? paymentResponseObject.profile.customerCountryCode : '',
             profileProcStatus: paymentResponseObject.profile.profileProcStatus ? paymentResponseObject.profile.profileProcStatus : '',
             profileProcStatusMsg: paymentResponseObject.profile.profileProcStatusMsg ? paymentResponseObject.profile.profileProcStatusMsg : ''
         };
     }
     if (paymentResponseObject.avsBilling) {
         this.avsBilling = {
             avsRespCode: paymentResponseObject.avsBilling.avsRespCode ? paymentResponseObject.avsBilling.avsRespCode : '',
             hostAVSRespCode: paymentResponseObject.avsBilling.hostAVSRespCode ? paymentResponseObject.avsBilling.hostAVSRespCode : ''
         };
     }
     if (paymentResponseObject.cardholderVerification) {
         this.cardholderVerification = {
             cvvRespCode: paymentResponseObject.cardholderVerification.cvvRespCode ? paymentResponseObject.cardholderVerification.cvvRespCode : '',
             hostCVVRespCode: paymentResponseObject.cardholderVerification.hostCVVRespCode ? paymentResponseObject.cardholderVerification.hostCVVRespCode : ''
         };
     }
 }
 PaymentResponseModel.prototype.createPaymentResponseObject = function (paymentResponseObject) {
     return paymentResponseObject;
 };
 PaymentResponseModel.prototype.getStatus = function () {
     var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');
     if (this.order.status.procStatusMessage === JPMCOrbitalConstants.Approved) {
         return true;
     } else if (this.order.status.procStatusMessage === JPMCOrbitalConstants.Declined) {
         return false;
     }
     return null;
 };
 PaymentResponseModel.prototype.getStatusMessage = function () {
     var procStatusMessage;
     if (this.order) {
         return this.order.status.procStatusMessage;
     }
     return procStatusMessage;
 };
 PaymentResponseModel.prototype.getTxRefNum = function () {
     var txRefNum;
     if (this.order.txRefNum) {
         txRefNum = this.order.txRefNum;
     }
     return txRefNum;
 };
 PaymentResponseModel.prototype.getResponseDateTime = function () {
     var respDateTime;
     if (this.order.respDateTime) {
         respDateTime = this.order.respDateTime;
     }
     return respDateTime;
 };
 PaymentResponseModel.prototype.getProfileObject = function () {
     if (this.profile) {
         return this.profile;
     }
     return null;
 };
 PaymentResponseModel.prototype.getProfileMessage = function () {
     var profileProcStatusMsg;
     if (this.profile) {
         return this.profile.profileProcStatusMsg;
     }
     return profileProcStatusMsg;
 };
 module.exports = PaymentResponseModel;
