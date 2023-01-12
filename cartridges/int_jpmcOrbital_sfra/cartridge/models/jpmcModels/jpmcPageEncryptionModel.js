'use strict';

var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');

/**
 * @param {Object} encryptedData encryptedData
 * @return {Object} pageEncryptionObject
 */
function getPageEncryptionObject(encryptedData) {
    var pageEncryptionObject = {};
    var encryptedCardData = JSON.parse(encryptedData);
    var preferenceHelper = require('*/cartridge/scripts/helpers/preferenceHelper');
    var pageEncryptionConfigurations = preferenceHelper.getPageEncryptionConfigurations();

    pageEncryptionObject.pieSubscriberID = pageEncryptionConfigurations.pieSubscriberID;
    pageEncryptionObject.pieFormatID = JPMCOrbitalConstants.pieFormatID;
    pageEncryptionObject.pieIntegrityCheck = encryptedCardData[2];
    pageEncryptionObject.pieKeyID = encryptedCardData[3];
    pageEncryptionObject.piePhaseID = encryptedCardData[4];
    pageEncryptionObject.pieMode = JPMCOrbitalConstants.FPE;

    return pageEncryptionObject;
}

/**
 * @param {Object} encryptedData encryptedData
 * @constructor
 */
function PageEncryptionModel(encryptedData) {
    var pageEncryptionObject = getPageEncryptionObject(encryptedData);

    this.pieSubscriberID = pageEncryptionObject.pieSubscriberID;
    this.pieFormatID = pageEncryptionObject.pieFormatID;
    this.pieIntegrityCheck = pageEncryptionObject.pieIntegrityCheck;
    this.pieKeyID = pageEncryptionObject.pieKeyID;
    this.piePhaseID = pageEncryptionObject.piePhaseID;
    this.pieMode = pageEncryptionObject.pieMode;
}

module.exports = PageEncryptionModel;
