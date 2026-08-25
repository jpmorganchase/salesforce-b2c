/**
 * Centralized service handling for JPMC integrations
 * Uses SFCC LocalServiceRegistry with parameter validation.
 * @module scripts/services/JPMCServiceHelper
 */

'use strict';

var Logger = require('dw/system/Logger').getLogger('JPMC', 'service');

/** @type {Array<string>} PCI-DSS sensitive payment fields - must be completely redacted */
var PAYMENT_SENSITIVE_FIELDS = [
    'cvv', 'encryptionIntegrityCheck', 'tokenNumber',
    'accountNumber', 'cardNumber', 'securityCode',
    'maskedAccountNumber', 'maskedPan', // Masked fields still contain PCI data
    'expirationMonth', 'expirationYear', 'cardExpirationMonthYearNumber',
    'checkoutSessionToken', 'sessionToken',
    'receiptHandle', 'receipt_handle',
    'orderToken', 'order_token',
    'accountHolderName', 'cardholderName', 'cardholder_name'
];

/** @type {Array<string>} OAuth/authentication sensitive fields */
var AUTH_SENSITIVE_FIELDS = [
    'accessToken', 'access_token', 'client_assertion', 'client_id',
    'client_assertion_type', 'client-assertion-type', 'resource', 'grant_type',
    'Authorization', 'authorization', 'headerFields'
];

/** @type {Array<string>} PII (Personally Identifiable Information) fields */
var PII_FIELDS = [
    'consumerProfileId', 'profileId', 'profile_id',
    'email', 'emailAddress', 'email_address',
    'phoneNumber', 'phone', 'phone_number',
    'firstName', 'first_name', 'lastName', 'last_name',
    'fullName', 'name',
    'address1', 'address2', 'line1', 'streetAddress', 'street_address', 'orderEmailAddress'
];

/**
 * Masks sensitive fields in a log message string (for filterLogMessage callback)
 * Uses complete redaction for PCI-DSS compliance - no partial values exposed
 * @private
 * @param {string} msg - log message to sanitize
 * @returns {string} message with sensitive values completely redacted
 */
function maskSensitiveData(msg) {
    if (!msg || typeof msg !== 'string') {
        return msg;
    }
    
    var masked = msg;
    var allSensitiveFields = PAYMENT_SENSITIVE_FIELDS.concat(AUTH_SENSITIVE_FIELDS).concat(PII_FIELDS);
    
    for (var i = 0; i < allSensitiveFields.length; i++) {
        var field = allSensitiveFields[i];
        
        // Case-insensitive JSON field masking - complete redaction
        var jsonPattern = new RegExp('("' + field + '"\\s*:\\s*)"([^"]+)"', 'gi');
        masked = masked.replace(jsonPattern, '$1"***REDACTED***"');
        
        // URL-encoded form data masking - complete redaction
        var formPattern = new RegExp('(' + field + '=)([^&\\s]+)', 'gi');
        masked = masked.replace(formPattern, '$1***REDACTED***');
    }
    
    return masked;
}

/**
 * @private
 * @param {Object} obj - key-value pairs to encode
 * @returns {string} URL-encoded form data
 */
function encodeFormData(obj) {
    var parts = [];
    
    Object.keys(obj).forEach(function (key) {
        var value = obj[key];
        if (value !== null && value !== undefined) {
            parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
        }
    });
    
    return parts.join('&');
}

/**
 * Validates URL suffix
 * @private
 * @param {string} urlSuffix - path to append to service URL
 * @returns {string|null} result
 */
function validateUrlSuffix(urlSuffix) {
    if (!urlSuffix) {
        return null;
    }
    // Only allow path-safe characters - no query strings (use urlParameters instead)
    if (!/^[a-zA-Z0-9\-_/.]+$/.test(urlSuffix)) {
        return null;
    }
    if (urlSuffix.indexOf('..') > -1) {
        return null;
    }
    
    return urlSuffix;
}

/**
 * Validates placeholder ID for injection attacks (whitelist)
 * @private
 * @param {string} placeHolderId - service credential placeholder identifier
 * @returns {string|null} validated ID or null
 */
function validatePlaceHolderId(placeHolderId) {
    if (!placeHolderId) {
        return null;
    }
    if (!/^[a-zA-Z0-9\-_]+$/.test(placeHolderId) || placeHolderId.length > 100) {
        return null;
    }
    
    return placeHolderId;
}

/**
 * Calls a service using SFCC Service Framework
 * @param {string} serviceId - SFCC service identifier
 * @param {Object} params - service call parameters
 * @returns {Object} service call result with ok, data, statusCode, errorMessage
 */
function callService(serviceId, params) {
    var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
    
    var result = {
        ok: false,
        data: null,
        statusCode: null,
        errorMessage: ''
    };

    if (!serviceId || !params || !params.method) {
        result.errorMessage = 'Invalid parameters: serviceId and method required';
        Logger.error('callService: {0}', result.errorMessage);
        return result;
    }

    try {
        var contentType = params.contentType || 'application/json';
        var isFormEncoded = contentType.indexOf('x-www-form-urlencoded') > -1;

        var service = LocalServiceRegistry.createService(serviceId, {
            createRequest: function (svc, requestData) { 
                if (!requestData) {
                    return null;
                }
                
                return isFormEncoded ? encodeFormData(requestData) : JSON.stringify(requestData);
            },

            parseResponse: function (svc, client) {
                return {
                    statusCode: client.getStatusCode(),
                    statusMessage: client.getStatusMessage(),
                    responseText: client.getText() || '',
                    ok: client.getStatusCode() >= 200 && client.getStatusCode() < 300
                };
            },

            filterLogMessage: function (msg) {
                return maskSensitiveData(msg);
            }
        });

        service.setRequestMethod(params.method.toUpperCase());
        service.addHeader('Content-Type', contentType);
        if (params.placeHolderId) {
            var validatedId = validatePlaceHolderId(params.placeHolderId);
            if (validatedId) {
                service.setURL(service.getURL().replace('{place-holder-id}', validatedId));
            }
        }
        if (params.urlSuffix) {
            var validatedSuffix = validateUrlSuffix(params.urlSuffix);
            if (validatedSuffix) {
                service.setURL(service.getURL() + validatedSuffix);
            }
        }
        
        if (params.headers) {
            Object.keys(params.headers).forEach(function (key) {
                service.addHeader(key, params.headers[key]);
            });
        }
        
        // Add URL query parameters
        if (params.urlParameters && typeof params.urlParameters === 'object') {
            Object.keys(params.urlParameters).forEach(function (key) {
                var value = params.urlParameters[key];
                if (value !== null && value !== undefined) {
                    service.addParam(key, String(value));
                }
            });
        }

        var callResult = service.call(params.payload || null);

        if (callResult.isOk()) {
            var responseObj = callResult.getObject();
            result.ok = responseObj.ok;
            result.statusCode = responseObj.statusCode;
            
            if (responseObj.responseText) {
                try {
                    result.data = JSON.parse(responseObj.responseText);
                } catch (e) {
                    result.data = responseObj.responseText;
                }
            }
        } else {
            result.statusCode = callResult.status;
            result.errorMessage = callResult.errorMessage || callResult.msg || 'Unknown error';
            Logger.error('Service {0} failed: {1}', serviceId, maskSensitiveData(result.errorMessage));
        }

    } catch (e) {
        var errorMessage = e instanceof Error ? e.message : String(e);
        result.errorMessage = errorMessage;
        Logger.error('Exception calling service {0}: {1}', serviceId, maskSensitiveData(errorMessage));
    }

    return result;
}

/**
 * Generates token and calls service in one operation
 * @param {Object} options - token generation and service call options
 * @returns {Object} service call result
 */
function callWithTokenGeneration(options) {
    if (!options || !options.tokenServiceId || !options.serviceId || !options.method) {
        var optionsError = 'callWithTokenGeneration: tokenServiceId, serviceId, and method are required';
        return {
            success: false,
            error: optionsError,
            statusCode: 400,
            timestamp: new Date().toISOString()
        };
    }
    
    var TokenManager = require('*/cartridge/scripts/helpers/TokenManager');
    
    try {
        var config;
        if (options.resolvedConfig) {
            var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
            config = JPMCMerchantResolver.toAccessTokenConfig(options.resolvedConfig);
        } else {
            var JPMCConfig = require('*/cartridge/scripts/helpers/JPMCConfig');
            config = JPMCConfig.getAccessTokenConfig();
        }
        
        var tokenResult = TokenManager.getValidToken(config, options.tokenServiceId);
        
        if (tokenResult.error) {
            Logger.error('Token retrieval failed: {0}', tokenResult.error);
            return {
                success: false,
                error: tokenResult.error,
                statusCode: tokenResult.statusCode || 500,
                timestamp: new Date().toISOString()
            };
        }
        var headers = options.headers || {};
        headers.Authorization = 'Bearer ' + tokenResult.accessToken;
        var serviceResult = callService(options.serviceId, {
            method: options.method,
            payload: options.data,
            headers: headers,
            placeHolderId: options.placeHolderId,
            urlSuffix: options.urlSuffix,
            urlParameters: options.urlParameters
        });
        
        return {
            success: serviceResult.ok,
            data: serviceResult.data,
            error: serviceResult.errorMessage,
            statusCode: serviceResult.statusCode,
            timestamp: new Date().toISOString()
        };
        
    } catch (e) {
        var errorMessage = e instanceof Error ? e.message : String(e);
        Logger.error('callWithTokenGeneration error: {0}', errorMessage);
        return {
            success: false,
            error: errorMessage,
            statusCode: 500,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = {
    callWithTokenGeneration: callWithTokenGeneration,
    maskSensitiveData: maskSensitiveData
};
