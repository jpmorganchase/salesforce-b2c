var JPMCOServices = require('*/cartridge/scripts/services/jpmcOServices.js');
var services = new JPMCOServices();
var ReversalModel = require('*/cartridge/models/jpmcCSCModels/reversalModel');
var preferenceHelper = require('*/cartridge/scripts/helpers/preferenceHelper');
var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');

/**
 * @param {string} avsResponse response code as a string
 * @returns {string} the corresponding status code
 * @desc
 */
function status(avsResponse) {
    var invalidStatusCodes = preferenceHelper.getAVSUnacceptedValues();
    if (!empty(invalidStatusCodes)) {
        return !(invalidStatusCodes.indexOf(avsResponse) > -1);
    }
    return true;
}

/**
* @function success
* @returns {boolean} true if the response code is B, false otherwise
* @param {Object} paymentResponseObject paymentResponseObject
 */
function success(paymentResponseObject) {
    if (paymentResponseObject) {
        return true;
    }
    return false;
}
/**
* @function fail
* @returns {boolean} true if reversal call successful, false otherwise
* @param {Object} paymentResponseObject paymentResponseObject
 */
function fail(paymentResponseObject) {
    if (paymentResponseObject.transType === JPMCOrbitalConstants.AuthorizationAndCapture) {
        var reversalObject = new ReversalModel(ReversalModel.getReversalObject(paymentResponseObject));
        var actionResponse = services.reversal(reversalObject);
        if (!actionResponse || actionResponse.status !== JPMCOrbitalConstants.OK) {
            return true;
        }
    }
    return false;
}


module.exports = { status: status, success: success, fail: fail };
