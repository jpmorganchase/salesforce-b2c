'use strict';

/**
 * Mock for dw.system.CacheMgr
 */
var caches = {};

function Cache(id) {
    this.id = id;
    this.data = {};
}

Cache.prototype.get = function (key) {
    return this.data[key] || null;
};

Cache.prototype.put = function (key, value) {
    this.data[key] = value;
};

Cache.prototype.invalidate = function (key) {
    if (key) {
        delete this.data[key];
    } else {
        this.data = {};
    }
};

Cache.prototype.clear = function () {
    this.data = {};
};

function CacheMgr() {}

CacheMgr.getCache = function (cacheId) {
    if (!caches[cacheId]) {
        caches[cacheId] = new Cache(cacheId);
    }
    return caches[cacheId];
};

/**
 * Helper to reset all caches
 */
CacheMgr.resetAllCaches = function () {
    caches = {};
};

/**
 * Helper to get cache for testing
 */
CacheMgr.getMockCache = function (cacheId) {
    return caches[cacheId] || null;
};

module.exports = CacheMgr;
