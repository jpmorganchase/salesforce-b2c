'use strict';

var ISML = require('dw/template/ISML');
var Transaction = require('dw/system/Transaction');
var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var Site = require('dw/system/Site');
var csrfProtection = require('dw/web/CSRFProtection');
var Resource = require('dw/web/Resource');
var Logger = require('dw/system/Logger').getLogger('JPMC', 'merchant-admin');

var CO_TYPE = 'JPMCMerchantConfig';
var RESOURCE_BUNDLE = 'jpmcbm';

/**
 * Returns true when the JPMCEnableMultiMerchant site preference is enabled.
 * @returns {boolean} result
 */
function isMultiMerchantEnabled() {
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
    return JPMCMerchantResolver.isMultiMerchantEnabled();
}

/**
 * Returns all allowed site locales except default.
 * @returns {Array<string>} locale ids
 */
function getAllowedLocales() {
    var locales = [];
    var allowedLocales = Site.getCurrent().getAllowedLocales();

    for (var i = 0; i < allowedLocales.size(); i++) {
        var locale = String(allowedLocales.get(i));
        if (locale !== 'default') {
            locales.push(locale);
        }
    }
    return locales;
}

/**
 * buildCsrfBlock - Creates CSRF token block for form protection
 * @returns {Object} object containing tokenName and token
 */
function buildCsrfBlock() {
    return {
        tokenName: csrfProtection.getTokenName(),
        token: csrfProtection.generateToken()
    };
}

/**
 * Renders the list template with multi-merchant disabled.
 * @returns {void}
 */
function renderDisabled() {
    ISML.renderTemplate('merchantadmin/list', {
        configs: [],
        siteId: Site.getCurrent().getID(),
        csrf: buildCsrfBlock(),
        multiMerchantEnabled: false
    });
}

/**
 * Builds pdict for merchant config edit/new page.
 * @param {Object} config - form model
 * @param {boolean} isNew - true for create mode
 * @param {string} error - error message
 * @returns {Object} pdict for template rendering
 */
function buildEditPdict(config, isNew, error) {
    var pdict = {
        config: config,
        isNew: isNew,
        csrf: buildCsrfBlock(),
        availableLocales: getAllowedLocales(),
        siteId: Site.getCurrent().getID()
    };
    if (error) {
        pdict.error = error;
    }
    return pdict;
}

/**
 * getCustomObject - Retrieves a JPMCMerchantConfig custom object by key
 * @param {string} configKey - config key
 * @returns {dw.object.CustomObject|null} custom object or null if not found
 */
function getCustomObject(configKey) {
    return CustomObjectMgr.getCustomObject(CO_TYPE, configKey);
}

/**
 * renderListError - Renders the list template with an error message
 * @param {string} error - error message to display
 * @returns {void}
 */
function renderListError(error) {
    ISML.renderTemplate('merchantadmin/list', {
        error: error,
        configs: [],
        siteId: Site.getCurrent().getID(),
        csrf: buildCsrfBlock()
    });
}

/**
 * JPMCMerchantAdmin-List : Displays list of locale-specific merchant configurations
 * @name JPMCMerchantAdmin-List
 * @function
 * @memberof JPMCMerchantAdmin
 */
exports.List = function () {
    var multiMerchantEnabled = isMultiMerchantEnabled();
    var siteId = Site.getCurrent().getID();
    var configs = [];

    if (multiMerchantEnabled) {
        var cos = CustomObjectMgr.getAllCustomObjects(CO_TYPE);

        try {
            while (cos.hasNext()) {
                var co = cos.next();
                var configKey = co.custom.configKey || '';
                var parts = configKey.split('::');
                var locale = parts.length > 1 ? parts[1] : '';

                if (locale && locale !== 'default') {
                    configs.push({
                        configKey: configKey,
                        locale: locale,
                        merchantId: co.custom.merchantId || '',
                        enabled: co.custom.enabled !== false
                    });
                }
            }
        } finally {
            cos.close();
        }
    }

    ISML.renderTemplate('merchantadmin/list', {
        configs: configs,
        siteId: siteId,
        csrf: buildCsrfBlock(),
        multiMerchantEnabled: multiMerchantEnabled
    });
};
exports.List.public = true;

/**
 * JPMCMerchantAdmin-Edit : Displays edit form for existing merchant configuration
 * @name JPMCMerchantAdmin-Edit
 * @function
 * @memberof JPMCMerchantAdmin
 * @param {querystringparameter} configKey - Configuration key to edit
 */
exports.Edit = function () {
    if (!isMultiMerchantEnabled()) { renderDisabled(); return; }

    var configKey = request.httpParameterMap.configKey.stringValue || '';

    if (!configKey) {
        renderListError(Resource.msg('error.config.notfound', RESOURCE_BUNDLE, null));
        return;
    }

    var co = getCustomObject(configKey);
    if (!co) {
        renderListError(Resource.msg('error.config.notfound', RESOURCE_BUNDLE, null));
        return;
    }

    var MerchantConfigHelper = require('~/cartridge/scripts/helpers/MerchantConfigHelper');
    var config = MerchantConfigHelper.buildEditConfig(co, true);
    ISML.renderTemplate('merchantadmin/edit', buildEditPdict(config, false, null));
};
exports.Edit.public = true;

/**
 * JPMCMerchantAdmin-New : Displays form for creating new merchant configuration
 * @name JPMCMerchantAdmin-New
 * @function
 * @memberof JPMCMerchantAdmin
 */
exports.New = function () {
    if (!isMultiMerchantEnabled()) { renderDisabled(); return; }

    var MerchantConfigHelper = require('~/cartridge/scripts/helpers/MerchantConfigHelper');
    var config = MerchantConfigHelper.getDefaultConfig();
    config.configKey = '';
    config.locale = '';

    ISML.renderTemplate('merchantadmin/edit', buildEditPdict(config, true, null));
};
exports.New.public = true;

/**
 * JPMCMerchantAdmin-GetLocaleConfig : Returns merchant configuration data for a specific locale (AJAX endpoint)
 * @name JPMCMerchantAdmin-GetLocaleConfig
 * @function
 * @memberof JPMCMerchantAdmin
 * @param {querystringparameter} locale - Locale identifier
 */
exports.GetLocaleConfig = function () {
    if (!isMultiMerchantEnabled()) {
        response.setStatus(403);
        response.setContentType('application/json');
        response.writer.print(JSON.stringify({ error: Resource.msg('error.multimerchant.disabled', RESOURCE_BUNDLE, null) }));
        return;
    }

    if (!csrfProtection.validateRequest()) {
        response.setStatus(403);
        response.setContentType('application/json');
        response.writer.print(JSON.stringify({ error: 'CSRF validation failed' }));
        return;
    }

    var MerchantConfigHelper = require('~/cartridge/scripts/helpers/MerchantConfigHelper');
    var locale = request.httpParameterMap.locale.stringValue || '';
    var siteId = Site.getCurrent().getID();

    if (!locale) {
        response.setContentType('application/json');
        response.writer.print(JSON.stringify({ configKey: '', data: MerchantConfigHelper.getDefaultConfig() }));
        return;
    }

    var configKey = siteId + '::' + locale;
    var co = getCustomObject(configKey);

    var result = {
        configKey: configKey,
        data: MerchantConfigHelper.getDefaultConfig()
    };

    if (co) {
        result.data = MerchantConfigHelper.buildEditConfig(co, true);
    }

    response.setContentType('application/json');
    response.writer.print(JSON.stringify(result));
};
exports.GetLocaleConfig.public = true;

/**
 * JPMCMerchantAdmin-Save : Saves merchant configuration (create or update)
 * @name JPMCMerchantAdmin-Save
 * @function
 * @memberof JPMCMerchantAdmin
 */
exports.Save = function () {
    if (!isMultiMerchantEnabled()) { renderDisabled(); return; }

    if (!csrfProtection.validateRequest()) {
        ISML.renderTemplate('csrfFail');
        return;
    }

    var MerchantConfigHelper = require('~/cartridge/scripts/helpers/MerchantConfigHelper');
    var params = request.httpParameterMap;
    var siteId = Site.getCurrent().getID();
    var locale = params.locale.stringValue || '';
    var isNew = params.configKey.stringValue === '';

    var formConfig;

    if (!locale) {
        formConfig = MerchantConfigHelper.buildFromParams(params);
        ISML.renderTemplate('merchantadmin/edit', buildEditPdict(
            formConfig,
            isNew,
            Resource.msg('error.locale.required', RESOURCE_BUNDLE, null)
        ));
        return;
    }

    var allowedLocales = getAllowedLocales();
    if (allowedLocales.indexOf(locale) === -1) {
        formConfig = MerchantConfigHelper.buildFromParams(params);
        ISML.renderTemplate('merchantadmin/edit', buildEditPdict(
            formConfig,
            true,
            Resource.msg('error.locale.required', RESOURCE_BUNDLE, null)
        ));
        return;
    }

    var configKey = siteId + '::' + locale;
    var merchantId = params.merchantId.stringValue || '';

    if (!merchantId) {
        formConfig = MerchantConfigHelper.buildFromParams(params);
        formConfig.locale = locale;
        ISML.renderTemplate('merchantadmin/edit', buildEditPdict(
            formConfig,
            isNew,
            Resource.msg('error.merchantid.required', RESOURCE_BUNDLE, null)
        ));
        return;
    }

    var wasNew = false;

    try {
        Transaction.wrap(function () {
            var co = getCustomObject(configKey);
            if (!co) {
                co = CustomObjectMgr.createCustomObject(CO_TYPE, configKey);
                wasNew = true;
            }

            var saveConfig = MerchantConfigHelper.buildFromParams(params);
            saveConfig.configKey = configKey;
            MerchantConfigHelper.assignToCustomObject(co, saveConfig);
        });

        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        JPMCMerchantResolver.invalidateCache(configKey, merchantId);

        exports.List();
    } catch (e) {
        Logger.error('Failed to save merchant config {0}: {1}', configKey, String(e));
        formConfig = MerchantConfigHelper.buildFromParams(params);
        formConfig.locale = locale;
        ISML.renderTemplate('merchantadmin/edit', buildEditPdict(
            formConfig,
            wasNew,
            Resource.msg('error.save.failed', RESOURCE_BUNDLE, null)
        ));
    }
};
exports.Save.public = true;

/**
 * JPMCMerchantAdmin-InvalidateCache : Clears merchant configuration cache for one or all configs
 * @name JPMCMerchantAdmin-InvalidateCache
 * @function
 * @memberof JPMCMerchantAdmin
 * @param {querystringparameter} configKey - Optional specific config key to invalidate
 */
exports.InvalidateCache = function () {
    if (!isMultiMerchantEnabled()) { renderDisabled(); return; }

    if (!csrfProtection.validateRequest()) {
        ISML.renderTemplate('csrfFail');
        return;
    }

    var configKey = request.httpParameterMap.configKey.stringValue || '';

    try {
        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        if (configKey) {
            JPMCMerchantResolver.invalidateCache(configKey);
        } else {
            var cos = CustomObjectMgr.getAllCustomObjects(CO_TYPE);
            try {
                while (cos.hasNext()) {
                    var co = cos.next();
                    JPMCMerchantResolver.invalidateCache(co.custom.configKey, co.custom.merchantId);
                }
            } finally {
                cos.close();
            }
        }
    } catch (e) {
        Logger.error('Failed to invalidate cache: {0}', String(e));
        renderListError(Resource.msg('error.save.failed', RESOURCE_BUNDLE, null));
        return;
    }

    exports.List();
};
exports.InvalidateCache.public = true;

/**
 * JPMCMerchantAdmin-Delete : Deletes merchant configuration and invalidates cache
 * @name JPMCMerchantAdmin-Delete
 * @function
 * @memberof JPMCMerchantAdmin
 * @param {querystringparameter} configKey - Configuration key to delete
 */
exports.Delete = function () {
    if (!isMultiMerchantEnabled()) { renderDisabled(); return; }

    if (!csrfProtection.validateRequest()) {
        ISML.renderTemplate('csrfFail');
        return;
    }

    var configKey = request.httpParameterMap.configKey.stringValue || '';

    if (!configKey) {
        exports.List();
        return;
    }

    try {
        Transaction.wrap(function () {
            var co = getCustomObject(configKey);
            if (co) {
                CustomObjectMgr.remove(co);
            }
        });

        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        JPMCMerchantResolver.invalidateCache(configKey);
    } catch (e) {
        Logger.error('Failed to delete merchant config {0}: {1}', configKey, String(e));
        renderListError(Resource.msg('error.save.failed', RESOURCE_BUNDLE, null));
        return;
    }
    exports.List();
};
exports.Delete.public = true;
