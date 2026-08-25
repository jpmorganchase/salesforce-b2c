'use strict';

var ISML = require('dw/template/ISML');
var CSRFProtection = require('dw/web/CSRFProtection');
var Resource = require('dw/web/Resource');
var Site = require('dw/system/Site');
var Transaction = require('dw/system/Transaction');
var URLUtils = require('dw/web/URLUtils');
var CertificateRef = require('dw/crypto/CertificateRef');
var CertificateUtils = require('dw/crypto/CertificateUtils');

var RESOURCE_BUNDLE = 'jpmcbm';

/**
 * Validate a certificate alias against the allowed pattern
 * @param {string} alias - certificate alias to validate
 * @returns {boolean} true if alias matches allowed pattern
 */
function isValidAlias(alias) {
    var constants = require('*/cartridge/scripts/helpers/JPMCConstants');
    return !!(alias && typeof alias === 'string' && constants.ALIAS_PATTERN.test(alias));
}

/**
 * @param {Object} data - JSON-serializable response data
 * @returns {void}
 */
function sendJsonResponse(data) {
    response.setContentType('application/json');
    response.writer.print(JSON.stringify(data));
}

/**
 * Build and send a standard JSON response
 * @param {boolean} success - whether the operation succeeded
 * @param {string|null} messageKey - resource bundle message key
 * @param {Object} additionalData - extra data to include in response
 * @returns {void}
 */
function sendStandardResponse(success, messageKey, additionalData) {
    var responseData = { success: success };
    
    if (messageKey) {
        responseData.message = Resource.msg(messageKey, RESOURCE_BUNDLE, null);
    }
    
    if (additionalData && typeof additionalData === 'object') {
        Object.keys(additionalData).forEach(function (key) {
            responseData[key] = additionalData[key];
        });
    }
    
    sendJsonResponse(responseData);
}

/**
 * Retrieve site preference value safely
 * @param {string} preferenceKey - site preference attribute name to validate
 * @returns {string} result
 */
function getSitePreference(preferenceKey) {
    var site = Site.getCurrent();
    var value = site.getCustomPreferenceValue(preferenceKey);
    return value || '';
}

/**
 * @returns {Array} result
 */
function getLocaleEntriesForThumbprint() {
    var CustomObjectMgr = require('dw/object/CustomObjectMgr');
    var site = Site.getCurrent();
    var siteId = site.getID();

    var seen = {};
    var localeIds = [];

    seen.default = true;
    localeIds.push('default');

    var allowedLocales = site.getAllowedLocales();
    for (var i = 0; i < allowedLocales.size(); i++) {
        var loc = String(allowedLocales.get(i));
        if (!seen[loc]) {
            seen[loc] = true;
            localeIds.push(loc);
        }
    }

    var coMap = {};
    for (var k = 0; k < localeIds.length; k++) {
        var coLocale = localeIds[k];
        var coConfigKey = siteId + '::' + coLocale;
        var co = CustomObjectMgr.getCustomObject('JPMCMerchantConfig', coConfigKey);
        if (co) {
            coMap[coConfigKey] = {
                certAlias: String(co.custom.certAlias || ''),
                privateKeyAlias: String(co.custom.privateKeyAlias || ''),
                hasKid: !!(co.custom.kid)
            };
        }
    }

    var entries = [];
    for (var j = 0; j < localeIds.length; j++) {
        var entryLocale = localeIds[j];
        var entryConfigKey = siteId + '::' + entryLocale;
        var coData = coMap[entryConfigKey] || null;
        entries.push({
            locale: entryLocale,
            configKey: entryConfigKey,
            hasCO: !!coData,
            certAlias: coData ? coData.certAlias : '',
            privateKeyAlias: coData ? coData.privateKeyAlias : '',
            hasKid: coData ? coData.hasKid : false
        });
    }
    return entries;
}

/**
 * @returns {void}
 */
function thumbprintGenerator() {
    try {
        var kidValue = getSitePreference('jpmc_kid');
        var localeEntries = getLocaleEntriesForThumbprint();
        var siteId = Site.getCurrent().getID();

        ISML.renderTemplate('jpmc/thumbprintGenerator', {
            kidConfigured: !!(kidValue),
            certAlias: getSitePreference('JPMCCertAlias'),
            privateKeyAlias: getSitePreference('JPMCPrivateKeyAlias'),
            localeEntries: localeEntries,
            siteId: siteId,
            saveUrl: URLUtils.url('JPMCTools-SaveThumbprint').toString(),
            getCertUrl: URLUtils.url('JPMCTools-GetCertificatePEM').toString(),
            csrfTokenGet: CSRFProtection.getTokenName() + '=' + CSRFProtection.generateToken(),
            csrfTokenSave: CSRFProtection.getTokenName() + '=' + CSRFProtection.generateToken()
        });
    } catch (e) {
        ISML.renderTemplate('csrfFail', {
            errorTitle: Resource.msg('error.csrf.title', RESOURCE_BUNDLE, null),
            errorMessage: Resource.msg('error.page.load', RESOURCE_BUNDLE, null)
        });
    }
}

/**
 * @returns {void}
 */
function getCertificatePEM() {
    if (!CSRFProtection.validateRequest()) {
        response.setStatus(403);
        sendStandardResponse(false, 'error.csrf.token.mismatch', null);
        return;
    }

    var certAlias = request.httpParameterMap.certAlias.stringValue || '';

    if (!certAlias) {
        response.setStatus(400);
        sendStandardResponse(false, 'thumbprint.js.error.cert.required', null);
        return;
    }

    if (!isValidAlias(certAlias)) {
        response.setStatus(400);
        sendStandardResponse(false, 'thumbprint.js.error.cert.not.found', null);
        return;
    }

    try {
        var certificateRef = new CertificateRef(certAlias);
        var derBase64 = CertificateUtils.getEncodedCertificate(certificateRef);

        if (!derBase64) {
            response.setStatus(404);
            sendStandardResponse(false, 'thumbprint.js.error.cert.not.found', null);
            return;
        }

        sendStandardResponse(true, null, { derBase64: derBase64 });
    } catch (e) {
        sendStandardResponse(false, 'thumbprint.js.error.cert.decode.failed', null);
    }
}

/**
 * @returns {void}
 */
function saveThumbprint() {
    if (!CSRFProtection.validateRequest()) {
        response.setStatus(403);
        sendStandardResponse(false, 'error.csrf.token.mismatch', null);
        return;
    }

    var kid = request.httpParameterMap.kid.stringValue || '';
    var configKey = request.httpParameterMap.configKey.stringValue || '';
    var certAlias = request.httpParameterMap.certAlias.stringValue || '';
    var privateKeyAlias = request.httpParameterMap.privateKeyAlias.stringValue || '';

    var constants = require('*/cartridge/scripts/helpers/JPMCConstants');

    if (!kid || !constants.THUMBPRINT_PATTERN.test(kid)) {
        response.setStatus(400);
        sendStandardResponse(false, 'thumbprint.js.error.save.failed', null);
        return;
    }

    if (configKey && !/^[a-zA-Z0-9_-]+::[a-zA-Z0-9_-]+$/.test(configKey)) {
        response.setStatus(400);
        sendStandardResponse(false, 'thumbprint.js.error.save.failed', null);
        return;
    }

    if (certAlias && !isValidAlias(certAlias)) {
        response.setStatus(400);
        sendStandardResponse(false, 'thumbprint.js.error.save.failed', null);
        return;
    }

    if (privateKeyAlias && !isValidAlias(privateKeyAlias)) {
        response.setStatus(400);
        sendStandardResponse(false, 'thumbprint.js.error.save.failed', null);
        return;
    }

    if (configKey && (!certAlias || !privateKeyAlias)) {
        response.setStatus(400);
        sendStandardResponse(false, 'thumbprint.js.error.save.failed', null);
        return;
    }

    try {
        if (configKey) {
            var CustomObjectMgr = require('dw/object/CustomObjectMgr');
            Transaction.wrap(function () {
                /** @type {dw.object.CustomObject} */
                var co = CustomObjectMgr.getCustomObject('JPMCMerchantConfig', configKey);
                var target = co || CustomObjectMgr.createCustomObject('JPMCMerchantConfig', configKey);
                if (!co) { target.custom.enabled = true; }
                target.custom.kid = kid;
                target.custom.certAlias = certAlias;
                target.custom.privateKeyAlias = privateKeyAlias;
            });

            var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
            JPMCMerchantResolver.invalidateCache(configKey);
        } else {
            var site = Site.getCurrent();
            Transaction.wrap(function () {
                site.setCustomPreferenceValue('jpmc_kid', kid);
            });
        }
        sendStandardResponse(true, 'thumbprint.js.success.saved', null);
    } catch (e) {
        sendStandardResponse(false, 'thumbprint.js.error.save.failed', null);
    }
}

module.exports.ThumbprintGenerator = thumbprintGenerator;
module.exports.ThumbprintGenerator.public = true;

module.exports.GetCertificatePEM = getCertificatePEM;
module.exports.GetCertificatePEM.public = true;

module.exports.SaveThumbprint = saveThumbprint;
module.exports.SaveThumbprint.public = true;
