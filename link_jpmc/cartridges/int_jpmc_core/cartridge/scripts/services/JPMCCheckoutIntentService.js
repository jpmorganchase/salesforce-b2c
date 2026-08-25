/**
 * JPMC Checkout Intent service wrapper.
 * Calls POST /checkout/intent to obtain a checkoutSessionToken for Drop-in UI.
 *
 * @module scripts/services/JPMCCheckoutIntentService
 */

'use strict';

var Logger = require('dw/system/Logger').getLogger('JPMC', 'checkout-intent');

/**
 * Creates a JPMC checkout session and returns the checkoutSessionToken.
 *
 * @param {Object} payload - request body for POST /checkout/intent
 * @param {Object} [options] - optional overrides
 * @param {Object} [options.resolvedConfig] - resolved JPMC merchant config
 * @param {string} [options.requestId] - explicit request id, otherwise auto-generated
 * @returns {{success: boolean, checkoutSessionToken: ?string, data: ?Object, error: ?string, statusCode: ?number}} result envelope
 */
function createCheckoutSession(payload, options) {
    var JPMCServiceHelper = require('*/cartridge/scripts/services/JPMCServiceHelper');
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
    var UUIDUtils = require('dw/util/UUIDUtils');

    var result = {
        success: false,
        checkoutSessionToken: null,
        data: null,
        error: null,
        statusCode: null
    };

    if (!payload || typeof payload !== 'object') {
        result.error = 'Payload is required';
        Logger.error('createCheckoutSession: {0}', result.error);
        return result;
    }

    try {
        var resolvedConfig = (options && options.resolvedConfig) || JPMCMerchantResolver.resolve();
        var merchantId = resolvedConfig && resolvedConfig.merchantId;

        if (!merchantId) {
            result.error = 'Merchant ID is not configured';
            Logger.error('createCheckoutSession: {0}', result.error);
            return result;
        }

        var requestId = (options && options.requestId) || UUIDUtils.createUUID().replace(/-/g, '').substring(0, 22);

        var serviceResult = JPMCServiceHelper.callWithTokenGeneration({
            tokenServiceId: 'JPMCAccessToken',
            serviceId: 'JPMCCheckoutIntent',
            method: 'POST',
            data: payload,
            headers: {
                merchantId: merchantId,
                requestId: requestId
            },
            resolvedConfig: resolvedConfig
        });

        result.statusCode = serviceResult.statusCode;
        result.data = serviceResult.data;

        Logger.debug('createCheckoutSession: status={0} hasResponseBody={1}',
            serviceResult.statusCode,
            !!serviceResult.data);

        if (!serviceResult.success) {
            result.error = serviceResult.error || 'Checkout intent service call failed';
            Logger.error('createCheckoutSession: status={0} error={1}',
                serviceResult.statusCode, result.error);
            return result;
        }

        var token = serviceResult.data && serviceResult.data.checkoutSessionToken;
        if (!token) {
            result.error = 'Checkout intent response did not contain checkoutSessionToken';
            Logger.error('createCheckoutSession: {0}', result.error);
            return result;
        }

        result.success = true;
        result.checkoutSessionToken = token;
        return result;
    } catch (e) {
        result.error = e instanceof Error ? e.message : String(e);
        Logger.error('createCheckoutSession exception: {0}', result.error);
        return result;
    }
}

module.exports = {
    createCheckoutSession: createCheckoutSession
};
