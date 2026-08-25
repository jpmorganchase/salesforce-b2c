/**
 * 3-tier token management: cache → custom object → generate
 * @module scripts/helpers/TokenManager
 */

'use strict';

var constants = require('*/cartridge/scripts/helpers/JPMCConstants');

/**
 * @param {number|string} expiresAt - token expiration timestamp (ms or ISO string)
 * @returns {boolean} true if token is expired or near expiry
 */
function isTokenExpired(expiresAt) {
    if (!expiresAt) return true;
    
    try {
        var expiryMs = typeof expiresAt === 'string' 
            ? new Date(expiresAt).getTime() 
            : expiresAt;
        return Date.now() > (expiryMs - constants.CLOCK_SKEW_SECONDS * 1000);
    } catch (e) {
        return true;
    }
}

/**
 * @param {string} cacheKey - cache identifier for the token
 * @returns {Object|null} cached token or null if expired/missing
 */
function getTokenFromCache(cacheKey) {
    try {
        var CacheMgr = require('dw/system/CacheMgr');
        var cache = CacheMgr.getCache(constants.TOKEN_CACHE_ID);
        
        if (!cache) return null;
        
        var token = cache.get(cacheKey);
        if (!token || isTokenExpired(token.expiresAt)) {
            if (token) cache.invalidate(cacheKey);
            return null;
        }
        
        return token;
    } catch (e) {
        return null;
    }
}

/**
 * @param {string} cacheKey - cache identifier for the token
 * @param {Object} tokenData - token data to store (accessToken, expiresAt)
 * @returns {boolean} true if stored successfully
 */
function storeTokenInCache(cacheKey, tokenData) {
    try {
        var CacheMgr = require('dw/system/CacheMgr');
        var cache = CacheMgr.getCache(constants.TOKEN_CACHE_ID);
        
        if (!cache) return false;
        
        cache.put(cacheKey, tokenData);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * @param {string} [tokenKey] - custom object key (defaults to TOKEN_CACHE_KEY)
 * @returns {Object|null} stored token or null if expired/missing
 */
function getTokenFromCustomObject(tokenKey) {
    try {
        var CustomObjectMgr = require('dw/object/CustomObjectMgr');
        var Transaction = require('dw/system/Transaction');
        var key = tokenKey || constants.TOKEN_CACHE_KEY;
        
        var co = CustomObjectMgr.getCustomObject(constants.TOKEN_CUSTOM_OBJECT_TYPE, key);
        if (!co) return null;
        
        var expiresAt = String(co.custom.expiresAt || '');
        
        if (isTokenExpired(expiresAt)) {
            Transaction.wrap(function() {
                CustomObjectMgr.remove(co);
            });
            return null;
        }
        
        return {
            accessToken: co.custom.accessToken,
            expiresAt: expiresAt,
            expiresIn: co.custom.expiresIn
        };
    } catch (e) {
        return null;
    }
}

/**
 * @param {string} accessToken - OAuth access token to persist
 * @param {number} expiresIn - token lifetime in seconds
 * @param {string} [tokenKey] - custom object key (defaults to TOKEN_CACHE_KEY)
 * @returns {boolean} true if stored successfully
 */
function storeTokenInCustomObject(accessToken, expiresIn, tokenKey) {
    try {
        var CustomObjectMgr = require('dw/object/CustomObjectMgr');
        var Transaction = require('dw/system/Transaction');
        var key = tokenKey || constants.TOKEN_CACHE_KEY;
        var expiresAtMs = Date.now() + (expiresIn * 1000);
        
        Transaction.wrap(function() {
            var existing = CustomObjectMgr.getCustomObject(constants.TOKEN_CUSTOM_OBJECT_TYPE, key);
            if (existing) CustomObjectMgr.remove(existing);
            
            var co = CustomObjectMgr.createCustomObject(constants.TOKEN_CUSTOM_OBJECT_TYPE, key);
            co.custom.accessToken = accessToken;
            co.custom.expiresIn = expiresIn;
            co.custom.expiresAt = new Date(expiresAtMs).toISOString();
            co.custom.issuedAt = new Date().toISOString();
            co.custom.type = 'Bearer';
        });
        
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * @param {string} jwt - signed JWT assertion
 * @param {Object} config - token service configuration
 * @param {string} serviceId - SFCC service identifier for token endpoint
 * @returns {Object} token response or error
 */
function requestToken(jwt, config, serviceId) {
    try {
        var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
        
        var payload = {
            client_id: config.client_id,
            client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            client_assertion: jwt,
            grant_type: 'client_credentials',
            resource: config.resource_id
        };
        
        var service = LocalServiceRegistry.createService(serviceId, {
            createRequest: function(svc) {
                var parts = [];
                Object.keys(payload).forEach(function(key) {
                    if (payload[key] != null) {
                        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(payload[key]));
                    }
                });
                svc.setRequestMethod('POST');
                svc.addHeader('Content-Type', 'application/x-www-form-urlencoded');
                return parts.join('&');
            },
            parseResponse: function(svc, client) {
                return JSON.parse(client.text);
            },
            filterLogMessage: function (msg) {
                var JPMCServiceHelper = require('*/cartridge/scripts/services/JPMCServiceHelper');
                return JPMCServiceHelper.maskSensitiveData(msg);
            }
        });
        
        var result = service.call();
        
        if (!result.ok || !result.object || !result.object.access_token) {
            return { error: result.errorMessage || 'Token request failed', statusCode: result.status || 500 };
        }
        
        return {
            ok: true,
            accessToken: result.object.access_token,
            expiresIn: result.object.expires_in,
            tokenType: result.object.token_type
        };
    } catch (e) {
        return { error: e.message || 'Token request failed', statusCode: 500 };
    }
}

/**
 * @param {Object} config - token service configuration (client_id, kid, etc.)
 * @param {string} [serviceId] - SFCC service identifier (defaults to JPMCAccessToken)
 * @returns {Object} cached or fresh access token
 */
function getValidToken(config, serviceId) {
    if (!config || !config.client_id) {
        return { error: 'Invalid configuration', statusCode: 500 };
    }
    
    var resolvedServiceId = serviceId || 'JPMCAccessToken';
    var merchantScopedKey = config.merchantId
        ? constants.TOKEN_CACHE_KEY_PREFIX + config.merchantId
        : constants.TOKEN_CACHE_KEY;

    var cached = getTokenFromCache(merchantScopedKey);
    if (cached) {
        return { accessToken: cached.accessToken, expiresIn: cached.expiresIn };
    }
    
    var stored = getTokenFromCustomObject(merchantScopedKey);
    if (stored) {
        storeTokenInCache(merchantScopedKey, stored);
        return { accessToken: stored.accessToken, expiresIn: stored.expiresIn };
    }
    
    var JWTHelper = require('*/cartridge/scripts/helpers/JWTHelper');
    var jwt;
    
    try {
        jwt = JWTHelper.generateJWT(config);
    } catch (e) {
        return { error: 'JWT generation failed', statusCode: 500 };
    }
    
    if (!jwt) {
        return { error: 'JWT generation failed', statusCode: 500 };
    }
    
    var result = requestToken(jwt, config, resolvedServiceId);
    
    if (result.error) {
        return { error: result.error, statusCode: result.statusCode };
    }
    
    var tokenData = {
        accessToken: result.accessToken,
        expiresAt: Date.now() + (result.expiresIn * 1000),
        expiresIn: result.expiresIn
    };
    
    storeTokenInCustomObject(result.accessToken, result.expiresIn, merchantScopedKey);
    storeTokenInCache(merchantScopedKey, tokenData);
    
    return { accessToken: result.accessToken, expiresIn: result.expiresIn };
}

module.exports = {
    getValidToken: getValidToken
};
