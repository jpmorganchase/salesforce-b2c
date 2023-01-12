'use strict';

var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');
var JpmcCardPresentModel = require('*/cartridge/models/jpmcModels/jpmcCardPresentModel');

/**
 *
 * @param {profileObject} profileObject profileObject
 */
function ProfileAddModel(profileObject) {
    this.version = JPMCOrbitalConstants.version;
    this.merchant = profileObject.merchant;
    this.order = profileObject.order;
    this.paymentInstrument = profileObject.paymentInstrument;
    this.profile = profileObject.profile;
    this.cardPresent = profileObject.cardPresent;
}

ProfileAddModel.getProfileAddObject = function (order, paymentObject, paymentInstrument, type) {
    var profileModel = require('*/cartridge/models/jpmcModels/jpmcProfileModel');
    var OrbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject(paymentObject.merchant.bin));
    var profileObject = JSON.parse(JSON.stringify(paymentObject));
    var debundlePaymentObject;
    var debundlePaymentInfo;
    var data;
    profileObject.order = {
        customerProfileOrderOverideInd: JPMCOrbitalConstants.NO,
        customerProfileFromOrderInd: JPMCOrbitalConstants.Authorization,
        orderDefaultAmount: JPMCOrbitalConstants.orderDefaultAmount
    };
    if (type === JPMCOrbitalConstants.CC) {
        profileObject.paymentInstrument = {
            card: paymentObject.paymentInstrument.card,
            customerAccountType: type
        };
    } else if (type === JPMCOrbitalConstants.GOOGLE) {
        debundlePaymentObject = OrbitalAPIHelper.prepareDebundlePaymentObjectForGooglePay(paymentInstrument);
        debundlePaymentInfo = OrbitalAPIHelper.debundlePaymentInfoForGooglePay(debundlePaymentObject);
        data = {
            ccExp: debundlePaymentInfo.TokenData.expirationYear.toString() + ((JPMCOrbitalConstants.n_0 + debundlePaymentInfo.TokenData.expirationMonth).slice(-2).toString()),
            ccAccountNum: debundlePaymentInfo.TokenData.pan,
            cardBrand: ''
        };
        profileObject.paymentInstrument = {
            card: data,
            customerAccountType: JPMCOrbitalConstants.CC
        };
    } else if (type === JPMCOrbitalConstants.VISA_CHECKOUT) {
        debundlePaymentObject = OrbitalAPIHelper.prepareDebundlePaymentObjectForVisaPay(paymentInstrument);
        debundlePaymentInfo = OrbitalAPIHelper.debundlePaymentInfoForVisaPay(debundlePaymentObject);
        data = {
            ccExp: debundlePaymentInfo.TokenData.expirationYear.toString() + ((JPMCOrbitalConstants.n_0 + debundlePaymentInfo.TokenData.expirationMonth).slice(-2).toString()),
            ccAccountNum: debundlePaymentInfo.TokenData.accountNumber,
            cardBrand: ''
        };
        profileObject.paymentInstrument = {
            card: data,
            customerAccountType: JPMCOrbitalConstants.CC
        };
    } else if (type === JPMCOrbitalConstants.APPLE) {
        debundlePaymentObject = OrbitalAPIHelper.prepareDebundlePaymentObjectForApplePay(paymentInstrument);
        debundlePaymentInfo = OrbitalAPIHelper.debundlePaymentInfoForApplePay(debundlePaymentObject);
        data = {
            ccExp: JPMCOrbitalConstants.n_20 + debundlePaymentInfo.TokenData.applicationExpirationDate.slice(0, 4),
            ccAccountNum: debundlePaymentInfo.TokenData.applicationPrimaryAccountNumber,
            cardBrand: ''
        };
        profileObject.paymentInstrument = {
            card: data,
            customerAccountType: JPMCOrbitalConstants.CC
        };
    } else {
        profileObject.paymentInstrument = {
            card: {
                cardBrand: JPMCOrbitalConstants.EC
            },
            ecp: paymentInstrument.electronicCheck,
            customerAccountType: type
        };
    }
    profileObject.profile = profileModel.getProfileObjectFromOrder(order);
    profileObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    return new ProfileAddModel(profileObject);
};

ProfileAddModel.getProfileAddObjectFromAccount = function (form, customer, type) {
    var profileModel = require('*/cartridge/models/jpmcModels/jpmcProfileModel');
    var profileObject = {};

    var JpmcMerchantModel = require('*/cartridge/models/jpmcModels/jpmcMerchantModel');
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject(MerchantModel.bin));
    var CardModel = require('*/cartridge/models/jpmcModels/jpmcCardModel');
    var ElectronicCheckModel = require('*/cartridge/models/jpmcModels/jpmcElectronicCheckModel');
    profileObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };
    profileObject.order = {
        customerProfileOrderOverideInd: JPMCOrbitalConstants.NO,
        customerProfileFromOrderInd: JPMCOrbitalConstants.Authorization,
        orderDefaultAmount: JPMCOrbitalConstants.orderDefaultAmount
    };
    if (type === JPMCOrbitalConstants.CC) {
        profileObject.paymentInstrument = {
            card: new CardModel(CardModel.getCardObjectForCredit(form)),
            customerAccountType: type
        };
    } else {
        profileObject.paymentInstrument = {
            card: {
                cardBrand: JPMCOrbitalConstants.EC
            },
            ecp: new ElectronicCheckModel(ElectronicCheckModel.getElectronicCheckObject(form)),
            customerAccountType: type
        };
    }
    profileObject.profile = profileModel.getProfileObjectFromAccount(customer);
    profileObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    return new ProfileAddModel(profileObject);
};
module.exports = ProfileAddModel;
