
var JPMCOrbitalConstants = require('../../../../mocks/jpmcOConstantsHelperMocks.test');
const assert = require('assert');

var additionalAuthInfoObject = {
    cardIndicators: JPMCOrbitalConstants.Y,
    paymentActionInd: JPMCOrbitalConstants.P
};

var AdditionalAuthInfoModel = require('../../../../mocks/jpmcModelsMocks/jpmcAdditionalAuthInfoModelMock.test');

describe('getAdditionalAuthInfo', function () {
    it('should return an AdditionalAuthInfo Object', function () {
        var result = new AdditionalAuthInfoModel(AdditionalAuthInfoModel.getCardTypeIndicatorObject(additionalAuthInfoObject));
        assert.equal(result.cardIndicators, JPMCOrbitalConstants.Y);
    });
});

