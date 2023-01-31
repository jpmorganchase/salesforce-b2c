'use strict';

const assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru();

const allKeysOfProfileResponseModel = [
    'version',
    'merchant',
    'order',
    'paymentInstrument',
    'profile'
];

var proxyquireStubs = {
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test')
};

describe('ProfileResponseModel unit test', function () {
    const ProfileResponseModelPath = '../../../../mocks/jpmcModelsMocks/jpmcProfileResponseModelMock.test.js';
    const ProfileResponseModel = proxyquire(ProfileResponseModelPath, {
        '*/cartridge/scripts/helpers/jpmcOConstantsHelper': proxyquireStubs.jpmcOConstantsHelperMocks
    });
    describe('ProfileResponseModel constructor function unit test', function () {
        let object = {
            version: '4.5',
            merchant: {
                bin: '000001'
            },
            order: {
                customerProfileOrderOverideInd: 'NO',
                customerProfileFromOrderInd: 'A',
                orderDefaultAmount: '1050'
            },
            paymentInstrument: {
                customerAccountType: 'CC',
                card: {
                    ccAccountNum: '5454545454545454',
                    ccExp: '202206'
                }
            },
            profile: {
                customerName: 'Customer Name',
                customerAddress1: '123 Main St',
                customerCity: 'Tampa',
                customerState: 'FL',
                customerZIP: '123456',
                customerEmail: 'email@email.com',
                customerPhone: '1234561234',
                customerCountryCode: 'US'
            }
        };

        let profileObject = new ProfileResponseModel(object);
        it('It should return ProfileResponseModel instance as typeof object', function () {
            assert.typeOf(profileObject, 'object');
            assert.instanceOf(profileObject, ProfileResponseModel);
        });
        it('It should return ProfileResponseModel instance with keys', function () {
            assert.hasAllKeys(profileObject, allKeysOfProfileResponseModel);
        });
        it('It should return ProfileResponseModel instance version', function () {
            assert.equal(profileObject.version, object.version);
        });
        it('It should return ProfileResponseModel instance merchant', function () {
            assert.equal(profileObject.merchant, object.merchant);
        });
        it('It should return ProfileResponseModel instance order', function () {
            assert.equal(profileObject.order, object.order);
        });
        it('It should return ProfileResponseModel instance paymentInstrument', function () {
            assert.equal(profileObject.paymentInstrument, object.paymentInstrument);
        });
        it('It should return ProfileResponseModel instance profile', function () {
            assert.equal(profileObject.profile, object.profile);
        });
    });
    describe('setProfileResponseObject method unit test', function () {
        let responseObject = {
            merchant: {
                bin: '000001'
            },
            order: {
                status: {
                    procStatusMessage: 'Profile Request Processed',
                    procStatus: '0'
                },
                orderDefaultAmount: '100000'
            },
            paymentInstrument: {
                customerAccountType: 'CC',
                card: {
                    ccExp: '202501',
                    ccAccountNum: '2221000000000009',
                    cardBrand: 'MC'
                }
            },
            profile: {
                profileOrderOverideInd: 'A',
                profileAction: 'CREATE',
                customerZIP: '11368',
                customerRefNum: '223858281',
                customerName: 'LUDWIG VAN BEETHOVEN',
                customerAddress1: 'BONNGASSE 20',
                accountUpdaterEligibility: 'Y'
            }
        };
        let profileObject = ProfileResponseModel.setProfileResponseObject(responseObject);
        it('It should return ProfileResponseModel instance as typeof object', function () {
            assert.typeOf(profileObject, 'object');
            assert.instanceOf(profileObject, ProfileResponseModel);
        });
        it('It should return ProfileResponseModel instance version', function () {
            assert.equal(profileObject.version, '4.5');
        });
        it('It should return ProfileResponseModel instance merchant bin', function () {
            assert.equal(profileObject.merchant.bin, '000001');
        });
        it('It should return ProfileResponseModel instance order status procStatusMessage ', function () {
            assert.equal(profileObject.order.status.procStatusMessage, 'Profile Request Processed');
        });
        it('It should return ProfileResponseModel instance order status procStatus ', function () {
            assert.equal(profileObject.order.status.procStatus, '0');
        });
        it('It should return ProfileResponseModel instance order orderDefaultAmount', function () {
            assert.equal(profileObject.order.orderDefaultAmount, '100000');
        });
        it('It should return ProfileResponseModel instance paymentInstrument card ccAccountNum', function () {
            assert.equal(profileObject.paymentInstrument.card.ccAccountNum, '2221000000000009');
        });
        it('It should return ProfileResponseModel instance paymentInstrument card ccExp', function () {
            assert.equal(profileObject.paymentInstrument.card.ccExp, '202501');
        });
        it('It should return ProfileResponseModel instance paymentInstrument card cardBrand', function () {
            assert.equal(profileObject.paymentInstrument.card.cardBrand, 'MC');
        });
        it('It should return ProfileResponseModel instance paymentInstrument customerAccountType', function () {
            assert.equal(profileObject.paymentInstrument.customerAccountType, 'CC');
        });
        it('It should return ProfileResponseModel instance profile profileOrderOverideInd', function () {
            assert.equal(profileObject.profile.profileOrderOverideInd, 'A');
        });
        it('It should return ProfileResponseModel instance profile profileAction', function () {
            assert.equal(profileObject.profile.profileAction, 'CREATE');
        });
        it('It should return ProfileResponseModel instance profile customerZIP', function () {
            assert.equal(profileObject.profile.customerZIP, '11368');
        });
        it('It should return ProfileResponseModel instance profile customerName', function () {
            assert.equal(profileObject.profile.customerName, 'LUDWIG VAN BEETHOVEN');
        });
        it('It should return ProfileResponseModel instance profile customerAddress1', function () {
            assert.equal(profileObject.profile.customerAddress1, 'BONNGASSE 20');
        });
        it('It should return ProfileResponseModel instance profile accountUpdaterEligibility', function () {
            assert.equal(profileObject.profile.accountUpdaterEligibility, 'Y');
        });
    });
});
