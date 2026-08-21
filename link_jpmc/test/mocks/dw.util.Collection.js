'use strict';

/**
 * Mock for dw.util.Collection
 * Based on SFRA test mocks
 */
function Collection(arr) {
    this.arr = arr || [];
  
    for (var i = 0; i < this.arr.length; i++) {
        this[i] = this.arr[i];
    }
    
    Object.defineProperty(this, 'length', {
        get: function () {
            return this.arr.length;
        },
        enumerable: true,
        configurable: true
    });
   
    Object.defineProperty(this, 'empty', {
        get: function () {
            return this.arr.length === 0;
        },
        enumerable: true,
        configurable: true
    });
}

Collection.prototype.iterator = function () {
    return {
        items: this.arr,
        index: 0,
        hasNext: function () {
            return this.index < this.items.length;
        },
        next: function () {
            return this.items[this.index++];
        }
    };
};

Collection.prototype.toArray = function () {
    return this.arr.slice();
};

Collection.prototype.getLength = function () {
    return this.arr.length;
};

Collection.prototype.size = function () {
    return this.arr.length;
};

Collection.prototype.isEmpty = function () {
    return this.arr.length === 0;
};

Collection.prototype.add = function (item) {
    this.arr.push(item);
};

Collection.prototype.contains = function (item) {
    return this.arr.indexOf(item) !== -1;
};

module.exports = Collection;
