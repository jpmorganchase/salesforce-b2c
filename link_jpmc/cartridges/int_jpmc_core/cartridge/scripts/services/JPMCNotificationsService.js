/**
 * JPMC Notifications service wrapper.
 *
 * @module scripts/services/JPMCNotificationsService
 */

'use strict';

var Logger = require('dw/system/Logger').getLogger('jpmc-notifications', 'poll');

var TRANSIENT_HTTP_CODES = { 502: true, 503: true, 504: true };

/**
 * Polls JPMC for notification messages within a given time window.
 *
 * @param {Object} options - polling options
 * @param {Object} [options.resolvedConfig]  - resolved JPMC merchant config
 * @param {string} [options.periodStart]     - ISO 8601 window start
 * @param {string} [options.periodEnd]       - ISO 8601 window end
 * @param {string} [options.pageToken]       - opaque pagination cursor from previous call
 * @returns {{
 *   success: boolean,
 *   transientError: boolean,
 *   messages: Array,
 *   nextPageToken: ?string,
 *   data: ?Object,
 *   error: ?string,
 *   statusCode: ?number
 * }} polling result with messages and pagination token
 */
function receive(options) {
    var JPMCServiceHelper  = require('*/cartridge/scripts/services/JPMCServiceHelper');
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');

    var result = {
        success:        false,
        transientError: false,
        messages:       [],
        nextPageToken:  null,
        data:           null,
        error:          null,
        statusCode:     null
    };

    var opts = options !== null && typeof options === 'object' ? options : {};

    var resolvedConfig = (opts.resolvedConfig !== null && typeof opts.resolvedConfig !== 'undefined')
        ? opts.resolvedConfig
        : JPMCMerchantResolver.resolve();

    var merchantId = resolvedConfig !== null && typeof resolvedConfig === 'object'
        ? resolvedConfig.merchantId
        : null;

    if (typeof merchantId !== 'string' || merchantId === '') {
        result.error = 'receive: merchantId is not configured';
        Logger.error(result.error);
        return result;
    }

    var now = new Date();
    var periodStart = typeof opts.periodStart === 'string' && opts.periodStart !== ''
        ? opts.periodStart
        : new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    var periodEnd = typeof opts.periodEnd === 'string' && opts.periodEnd !== ''
        ? opts.periodEnd
        : now.toISOString();

    // Build query parameters object
    var urlParameters = {
        periodStart: periodStart,
        periodEnd: periodEnd,
        pageSize: '100' // Request maximum page size (JPMC caps at 100)
    };

    if (typeof opts.pageToken === 'string' && opts.pageToken !== '') {
        urlParameters.pageToken = opts.pageToken;
        Logger.info('receive: pagination request — including pageToken parameter');
    }

    var serviceResult = JPMCServiceHelper.callWithTokenGeneration({
        tokenServiceId: 'JPMCAccessToken',
        serviceId:      'JPMCNotificationsReceive',
        method:         'GET',
        urlParameters:  urlParameters,
        headers:        { 'MERCHANTID': merchantId },
        resolvedConfig: resolvedConfig
    });

    Logger.debug('receive: request with parameters: periodStart={0}, periodEnd={1}, pageSize={2}',
        periodStart, periodEnd, urlParameters.pageSize);

    result.statusCode = serviceResult.statusCode;
    result.data       = serviceResult.data;

    // Transient error detection (Constraint #1)
    if (typeof serviceResult.statusCode === 'number'
            && TRANSIENT_HTTP_CODES[serviceResult.statusCode] === true) {
        result.transientError = true;
        result.error = 'receive: transient HTTP ' + serviceResult.statusCode;
        Logger.error(result.error);
        return result;
    }

    if (!serviceResult.success) {
        result.error = serviceResult.error !== null && typeof serviceResult.error !== 'undefined'
            ? String(serviceResult.error)
            : 'receive: service call failed (HTTP ' + serviceResult.statusCode + ')';
        Logger.error('JPMCNotificationsService.receive: {0}', result.error);
        return result;
    }

    var data     = (serviceResult.data !== null && typeof serviceResult.data === 'object') ? serviceResult.data : {};
    var messages = Array.isArray(data.messages) ? data.messages : [];

    result.success       = true;
    result.messages      = messages;
    result.nextPageToken = typeof data.nextPageToken === 'string' && data.nextPageToken !== ''
        ? data.nextPageToken
        : null;

    Logger.info('JPMCNotificationsService.receive: {0} messages, nextPageToken={1}',
        messages.length, result.nextPageToken !== null ? result.nextPageToken.substring(0, 20) + '...' : 'none');

    return result;
}

/**
 * Acknowledges a batch of notification messages.
 * Returns HTTP 200 even when some ACKs fail — caller must inspect ackFailedMessages.
 *
 * @param {{ messageInfos: Array<{messageId: string, receiptHandle: string}> }} payload - batch of messages to acknowledge
 * @param {Object} [options] - optional parameters
 * @param {Object} [options.resolvedConfig] - resolved JPMC merchant config
 * @returns {{
 *   success: boolean,
 *   transientError: boolean,
 *   data: ?Object,
 *   error: ?string,
 *   statusCode: ?number
 * }} - acknowledgement result
 */
function acknowledge(payload, options) {
    var JPMCServiceHelper    = require('*/cartridge/scripts/services/JPMCServiceHelper');
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');

    var result = {
        success:        false,
        transientError: false,
        data:           null,
        error:          null,
        statusCode:     null
    };

    // Strict payload validation (Constraint #5 — no global empty())
    if (payload === null || typeof payload !== 'object'
            || !Array.isArray(payload.messageInfos)
            || payload.messageInfos.length === 0) {
        result.error = 'acknowledge: messageInfos array with at least one entry is required';
        Logger.error(result.error);
        return result;
    }

    var opts = options !== null && typeof options === 'object' ? options : {};

    var resolvedConfig = (opts.resolvedConfig !== null && typeof opts.resolvedConfig !== 'undefined')
        ? opts.resolvedConfig
        : JPMCMerchantResolver.resolve();

    var merchantId = resolvedConfig !== null && typeof resolvedConfig === 'object'
        ? resolvedConfig.merchantId
        : null;

    if (typeof merchantId !== 'string' || merchantId === '') {
        result.error = 'acknowledge: merchantId is not configured';
        Logger.error(result.error);
        return result;
    }

    var serviceResult = JPMCServiceHelper.callWithTokenGeneration({
        tokenServiceId: 'JPMCAccessToken',
        serviceId:      'JPMCNotificationsAck',
        method:         'POST',
        data:           payload,
        headers:        { 'MERCHANTID': merchantId },
        resolvedConfig: resolvedConfig
    });

    result.statusCode = serviceResult.statusCode;
    result.data       = serviceResult.data;

    if (typeof serviceResult.statusCode === 'number'
            && TRANSIENT_HTTP_CODES[serviceResult.statusCode] === true) {
        result.transientError = true;
        result.error = 'acknowledge: transient HTTP ' + serviceResult.statusCode;
        Logger.error(result.error);
        return result;
    }

    if (!serviceResult.success) {
        result.error = serviceResult.error !== null && typeof serviceResult.error !== 'undefined'
            ? String(serviceResult.error)
            : 'acknowledge: service call failed (HTTP ' + serviceResult.statusCode + ')';
        Logger.error('JPMCNotificationsService.acknowledge: {0}', result.error);
        return result;
    }

    var ackData     = (serviceResult.data !== null && typeof serviceResult.data === 'object') ? serviceResult.data : {};
    var ackFailed   = Array.isArray(ackData.ackFailedMessages) ? ackData.ackFailedMessages : [];

    Logger.info('JPMCNotificationsService.acknowledge: sent={0} ackFailed={1}',
        payload.messageInfos.length, ackFailed.length);

    if (ackFailed.length > 0) {
        Logger.warn('JPMCNotificationsService.acknowledge: {0} messages were not ACKed by the API',
            ackFailed.length);
    }

    result.success = true;
    return result;
}

module.exports = {
    receive:     receive,
    acknowledge: acknowledge
};
