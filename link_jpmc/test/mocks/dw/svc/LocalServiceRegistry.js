'use strict';

/**
 * Mock for dw.svc.LocalServiceRegistry
 */
var services = {};

function Service(serviceId, config) {
    this.serviceId = serviceId;
    this.config = config;
    this.requestMethod = 'GET';
    this.headers = {};
    this.mockResponse = null;
    this.mockError = null;
}

Service.prototype.setRequestMethod = function (method) {
    this.requestMethod = method;
};

Service.prototype.addHeader = function (name, value) {
    this.headers[name] = value;
};

Service.prototype.call = function () {
    var self = this;
    
    // If mock error is set, return error result
    if (this.mockError) {
        return {
            ok: false,
            error: true,
            status: this.mockError.status || 500,
            errorMessage: this.mockError.message || 'Service call failed',
            object: null
        };
    }
    
    // Create request
    var request = this.config.createRequest ? this.config.createRequest(this) : null;
    
    // If mock response is set, use it
    if (this.mockResponse) {
        var client = {
            text: typeof this.mockResponse === 'string' 
                ? this.mockResponse 
                : JSON.stringify(this.mockResponse)
        };
        
        var responseObject = this.config.parseResponse 
            ? this.config.parseResponse(this, client) 
            : this.mockResponse;
        
        return {
            ok: true,
            error: false,
            status: 200,
            object: responseObject,
            errorMessage: null
        };
    }
    
    // Default error response if no mock is set
    return {
        ok: false,
        error: true,
        status: 500,
        errorMessage: 'No mock response configured',
        object: null
    };
};

/**
 * Set mock response for testing
 */
Service.prototype.setMockResponse = function (response) {
    this.mockResponse = response;
};

/**
 * Set mock error for testing
 */
Service.prototype.setMockError = function (error) {
    this.mockError = error;
};

function LocalServiceRegistry() {}

LocalServiceRegistry.createService = function (serviceId, config) {
    var service = new Service(serviceId, config);
    services[serviceId] = service;
    return service;
};

/**
 * Helper to get service for testing
 */
LocalServiceRegistry.getMockService = function (serviceId) {
    return services[serviceId] || null;
};

/**
 * Helper to reset all services
 */
LocalServiceRegistry.resetAllServices = function () {
    services = {};
};

module.exports = LocalServiceRegistry;
