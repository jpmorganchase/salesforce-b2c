'use strict';

var JPMCOrbitalConstants = require('../jpmcOConstantsHelperMocks.test');

/**
 *
 * @param {tokenObject} tokenObject tokenObject
 */
function TokenResponseModel(tokenObject) {
    this.version = JPMCOrbitalConstants.version;
    this.merchant = tokenObject.merchant;
    this.order = tokenObject.order;
    this.paymentInstrument = tokenObject.paymentInstrument;
    this.token = tokenObject.token;
}

TokenResponseModel.setTokenResponseObject = function (responseObject) {
    if (responseObject) {
        var tokenResponseObject = {};
        tokenResponseObject.merchant = responseObject.merchant;
        tokenResponseObject.order = responseObject.order;
        tokenResponseObject.paymentInstrument = {
            card: responseObject.paymentInstrument.card
        };
        tokenResponseObject.token = responseObject.token;
        return new TokenResponseModel(tokenResponseObject);
    }
    return null;
};
module.exports = TokenResponseModel;
