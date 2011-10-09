/*global setTimeout: false, clearTimeout: false, module: false, process: false */
/*jshint eqnull: true, plusplus: false, bitwise: false */

(function (root) {
    "use strict";
    
    /**
     * Whether we're currently in "debug" or "development" mode. Setting this
     * to false will have performance improvements, but not be as "safe" in
     * some regards.
     */
    var DEBUG = true;
    
    var concur = {};
    
    var previousConcur = root.concur;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = concur;
    } else {
        root.concur = concur;
    }
    
    /**
     * Replace the global 'concur' identifier with the previous version.
     * Return a reference to the current concur library.
     *
     * @returns {Object} The concur library
     * @example var myConcur = concur.noConflict();
     */
    concur.noConflict = function () {
        root.concur = previousConcur;
        return concur;
    };
    
    /**
     * Execute a callback asynchronously and as soon as possible.
     * In node.js, this is just an alias to process.nextTick.
     * In browsers, this leverages setTimeout with a delay of 0 ms.
     *
     * @param {Function} The function to call
     * @param {any} A value to pass in as the 'this' value for the callback
     * @example concur.nextTick(function () { heyThere(); });
     */
    var nextTick;
    if (typeof process !== "undefined" && typeof process.nextTick === "function") {
        nextTick = function (callback, thisArg) {
            if (typeof callback !== "function") {
                throw new TypeError("callback must be a function");
            }
            if (thisArg == null) {
                process.nextTick(callback);
            } else {
                process.nextTick(function () {
                    callback.call(thisArg);
                });
            }
        };
    } else {
        nextTick = function (callback, thisArg) {
            if (typeof callback !== "function") {
                throw new TypeError("callback must be a function");
            }
            if (thisArg == null) {
                setTimeout(callback, 0);
            } else {
                setTimeout(function () {
                    callback.call(thisArg);
                }, 0);
            }
        };
    }
    concur.nextTick = nextTick;
    
    /**
     * Convert to an Object
     */
    var toObject = "x"[0] === "x" ? Object : function (value) {
        if (typeof value === "string") {
            return value.split("");
        } else {
            return Object(value);
        }
    };
    
    /**
     * Alias to Array.prototype.slice
     *
     * @api private
     */
    var slice = Array.prototype.slice;
    
    /**
     * Alias to Object.prototype.hasOwnProperty
     *
     * @api private
     */
    var has = Object.prototype.hasOwnProperty;
    
    /**
     * Wrap a callback such that it can only be called once and errors on other
     * calls. This prevents a case where someone uses a forEach loop but calls
     * the callback twice, causing strange errors.
     *
     * @api private
     * @param {Function} the callback which to wrap
     * @returns {Function} the wrapped callback
     * @example var f = once(function() { return 5; }); f() === 5; f() // Error
     */
    var once = DEBUG ? function (callback) {
        var first = true;
        return function () {
            if (first) {
                first = false;
                return callback.apply(this, slice.call(arguments));
            } else {
                throw new Error("Cannot execute callback more than once");
            }
        };
    } : function (callback) {
        return callback;
    };
    
    /**
     * A special object that, when "thrown" in one of concur's loops, acts like
     * the "break" statement. It is not recommended to use with map or filter
     * or other non-simple loops, as results may be unexpected.
     *
     * @api public
     * 
     * @example
     * concur.forEach(array, function (item, callback) {
     *     if (item === "bad") {
     *         callback(concur.STOP);
     *     } else {
     *         callback(); // all good
     *     }
     * })
     */
    var STOP = concur.STOP = {};
    if (typeof Object.freeze === "function") {
        Object.freeze(STOP);
    }
    
    /**
     * Curry the first argument of a function
     *
     * @api private
     *
     * @param {Function} the function to curry
     * @param {any} the first argument to always pass in to the curried function
     * @returns {Function} the resultant curried function
     * @example curry(function (a, b) { return a + b; }, 5)(10) === 15;
     */
    var curry = function (func, arg) {
        return function () {
            func.apply(this, [arg].concat(slice.call(arguments)));
        };
    };
    
    /**
     * Run an asynchronous for loop that iterates from start to finish (exclusive).
     *
     * @api public
     *
     * @param {Number} The amount of concurrent functions to allow at once
     * @param {Number} The number to start with
     * @param {Number} The number to loop up to, but not reaching
     * @param {Function} A function to call once per value. Parameters are (index, callback)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.rangeLimit(20, 0, 100, function (i, callback) {
     *     doSomethingAsynchronous(i * i, callback);
     * }, function (err) {
     *     // woo, all done
     * })
     */
    var rangeLimit = concur.rangeLimit = function (limit, start, finish, onValue, onComplete, thisArg) {
        limit >>>= 0; // coerce to UInt32
        if (limit <= 0) {
            limit = Infinity;
        }
        if (typeof onValue !== "function") {
            throw new TypeError("onValue is not a function");
        }
        if (typeof onComplete !== "function") {
            throw new TypeError("onComplete is not a function");
        }
        if (finish <= start) {
            onComplete.call(thisArg);
            return;
        }
        
        var slotsUsed = 0;
        var broken = null;
        var next;
        var synchronous = false;
        var onValueCallback = function (err) {
            if (err && !broken) {
                broken = err;
            }
            --slotsUsed;
            if (!synchronous) {
                next();
            }
        };
        var i = start;
        next = function () {
            while (!broken && slotsUsed < limit && i < finish) {
                ++slotsUsed;
                synchronous = true;
                onValue.call(thisArg, i, once(onValueCallback));
                synchronous = false;
                ++i;
            }
            if (slotsUsed === 0) {
                onComplete.call(thisArg, broken === STOP ? null : broken);
            }
        };
        next();
    };
    
    /**
     * Run an asynchronous for loop that iterates from start to finish (exclusive).
     * All callbacks are run concurrently.
     *
     * @api public
     *
     * @param {Number} The number to start with
     * @param {Number} The number to loop up to, but not reaching
     * @param {Function} A function to call once per value. Parameters are (index, callback)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.range(0, 100, function (i, callback) {
     *     doSomethingAsynchronous(i * i, callback);
     * }, function (err) {
     *     // woo, all done
     * })
     */
    concur.range = curry(rangeLimit, 0);
    
    /**
     * Run an asynchronous for loop that iterates from start to finish (exclusive).
     * Only one callback is run at a time.
     *
     * @api public
     *
     * @param {Number} The number to start with
     * @param {Number} The number to loop up to, but not reaching
     * @param {Function} A function to call once per value. Parameters are (index, callback)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.rangeSeries(0, 100, function (i, callback) {
     *     doSomethingAsynchronous(i * i, callback);
     * }, function (err) {
     *     // woo, all done
     * })
     */
    concur.rangeSeries = curry(rangeLimit, 1);
    
    /**
     * Run an asynchronous for-each loop that iterates over the contents of an
     * array.
     *
     * @api public
     *
     * @param {Number} The amount of concurrent functions to allow at once
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (value, callback, index, array)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.forEachLimit(2, [10, 5, 0, 20], function (value, callback) {
     *     setTimeout(function () {
     *         callback();
     *     }, value * 100);
     * }, function (err) {
     *     // woo, all done, should've taken roughly 2.5 seconds
     * })
     */
    var forEachLimit = concur.forEachLimit = function (limit, array, onValue, onComplete, thisArg) {
        limit >>>= 0; // coerce to UInt32
        if (limit <= 0) {
            limit = Infinity;
        }
        if (array == null) {
            throw new TypeError("array is null or undefined");
        }
        array = toObject(array);
        var length = array.length >>> 0; // coerce to UInt32
        if (typeof onValue !== "function") {
            throw new TypeError("onValue is not a function");
        }
        if (typeof onComplete !== "function") {
            throw new TypeError("onComplete is not a function");
        }
        if (length === 0) {
            onComplete.call(thisArg);
            return;
        }
        
        var slotsUsed = 0;
        var broken = null;
        var next;
        var synchronous = false;
        var onValueCallback = function (err, value) {
            if (err && !broken) {
                broken = err;
            }
            --slotsUsed;
            if (!synchronous) {
                next();
            }
        };
        var i = 0;
        next = function () {
            while (!broken && slotsUsed < limit && i < length) {
                if (i in array) {
                    ++slotsUsed;
                    synchronous = true;
                    onValue.call(thisArg, array[i], once(onValueCallback), i, array);
                    synchronous = false;
                }
                ++i;
            }
            if (slotsUsed === 0) {
                onComplete.call(thisArg, broken === STOP ? null : broken);
            }
        };
        next();
    };
    
    /**
     * Run an asynchronous for-each loop that iterates over the contents of an
     * array.
     * All callbacks are run concurrently.
     *
     * @api public
     *
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (value, callback, index, array)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.forEach([10, 5, 0, 20], function (value, callback) {
     *     setTimeout(function () {
     *         callback();
     *     }, value * 100);
     * }, function (err) {
     *     // woo, all done, should've taken roughly 2 seconds
     * })
     */
    concur.forEach = curry(forEachLimit, 0);
    
    /**
     * Run an asynchronous for-each loop that iterates over the contents of an
     * array.
     * Only one callback is run at a time.
     *
     * @api public
     *
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (value, callback, index, array)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.forEachSeries([10, 5, 0, 20], function (value, callback) {
     *     setTimeout(function () {
     *         callback();
     *     }, value * 100);
     * }, function (err) {
     *     // woo, all done, should've taken roughly 3.5 seconds
     * })
     */
    concur.forEachSeries = curry(forEachLimit, 1);
    
    /**
     * A special token on whether to not include a value in the resultant array when using map.
     *
     * @api private
     */
    var DELETE = {};
    
    /**
     * Run an asynchronous map that iterates over the contents of an array and
     * constructs a new array based on the result of the callbacks.
     * Regardless of how long it takes the callbacks to return, the result
     * array will be in the same order as passed in.
     *
     * @api public
     *
     * @param {Number} The amount of concurrent functions to allow at once
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (value, callback, index, array)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, resultArray)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.mapLimit(2, ["apple", "pie", "tomato"], function (word, callback) {
     *     setTimeout(function () {
     *         callback(null, word.toUpperCase());
     *     }, word.length * 100);
     * }, function (err, result) {
     *     // woo, all done, should've taken roughly 0.9 seconds
     *     // result should be ["APPLE", "PIE", "TOMATO"]
     * })
     */
    var mapLimit = concur.mapLimit = function (limit, array, onValue, onComplete, thisArg) {
        if (array == null) {
            throw new TypeError("array is null or undefined");
        }
        array = toObject(array);
        var length = array.length >>> 0; // coerce to UInt32
        var result = new Array(length);
        forEachLimit(limit, array, function (item, callback, i, array) {
            onValue.call(this, item, once(function (err, value) {
                if (err) {
                    callback(err);
                } else {
                    if (value !== DELETE) {
                        result[i] = value;
                    }
                    callback();
                }
            }), i, array);
        }, function (err) {
            onComplete.call(this, err, err != null ? null : result);
        }, thisArg);
    };
    
    /**
     * Run an asynchronous map that iterates over the contents of an array and
     * constructs a new array based on the result of the callbacks.
     * Regardless of how long it takes the callbacks to return, the result
     * array will be in the same order as passed in.
     * All callbacks are run concurrently.
     *
     * @api public
     *
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (value, callback, index, array)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, resultArray)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.map(["apple", "pie", "tomato"], function (word, callback) {
     *     setTimeout(function () {
     *         callback(null, word.toUpperCase());
     *     }, word.length * 100);
     * }, function (err, result) {
     *     // woo, all done, should've taken roughly 0.6 seconds
     *     // result should be ["APPLE", "PIE", "TOMATO"]
     * })
     */
    concur.map = curry(mapLimit, 0);
    
    /**
     * Run an asynchronous map that iterates over the contents of an array and
     * constructs a new array based on the result of the callbacks.
     * Regardless of how long it takes the callbacks to return, the result
     * array will be in the same order as passed in.
     * Only one callback is run at a time.
     *
     * @api public
     *
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (value, callback, index, array)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, resultArray)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.mapSeries(["apple", "pie", "tomato"], function (word, callback) {
     *     setTimeout(function () {
     *         callback(null, word.toUpperCase());
     *     }, word.length * 100);
     * }, function (err, result) {
     *     // woo, all done, should've taken roughly 1.4 seconds
     *     // result should be ["APPLE", "PIE", "TOMATO"]
     * })
     */
    concur.mapSeries = curry(mapLimit, 1);
    
    /**
     * Run an asynchronous filter that iterates over the contents of an array and
     * constructs a new array based on the whether the callback returns a truthy
     * value.
     * Regardless of how long it takes the callbacks to return, the result
     * array will be in the same order as passed in.
     *
     * @api public
     *
     * @param {Number} The amount of concurrent functions to allow at once
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (value, callback, index, array)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, resultArray)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.filterLimit(2, ["apple", "pie", "tomato"], function (word, callback) {
     *     setTimeout(function () {
     *         callback(null, word.length % 2 === 1);
     *     }, word.length * 100);
     * }, function (err, result) {
     *     // woo, all done, should've taken roughly 0.9 seconds
     *     // result should be ["apple", "pie"]
     * })
     */
    var filterLimit = concur.filterLimit = function (limit, array, onValue, onComplete, thisArg) {
        if (array == null) {
            throw new TypeError("array is null or undefined");
        }
        array = toObject(array);
        var length = array.length >>> 0; // coerce to UInt32
        var checks = new Array(length);
        forEachLimit(limit, array, function (item, callback, i, array) {
            onValue.call(this, item, once(function (err, value) {
                if (err) {
                    callback(err);
                } else {
                    if (value) {
                        checks[i] = true;
                    }
                    callback();
                }
            }), i, array);
        }, function (err) {
            if (err) {
                onComplete.call(this, err);
            } else {
                var result = [];
                for (var i = 0; i < length; ++i) {
                    if (i in checks) {
                        result.push(array[i]);
                    }
                }
                onComplete.call(this, null, result);
            }
        }, thisArg);
    };
    
    /**
     * Run an asynchronous filter that iterates over the contents of an array and
     * constructs a new array based on the whether the callback returns a truthy
     * value.
     * Regardless of how long it takes the callbacks to return, the result
     * array will be in the same order as passed in.
     * All callbacks are run concurrently.
     *
     * @api public
     *
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (value, callback, index, array)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, resultArray)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.filter(["apple", "pie", "tomato"], function (word, callback) {
     *     setTimeout(function () {
     *         callback(null, word.length % 2 === 1);
     *     }, word.length * 100);
     * }, function (err, result) {
     *     // woo, all done, should've taken roughly 0.6 seconds
     *     // result should be ["apple", "pie"]
     * })
     */
    concur.filter = curry(filterLimit, 0);
    
    /**
     * Run an asynchronous filter that iterates over the contents of an array and
     * constructs a new array based on the whether the callback returns a truthy
     * value.
     * Regardless of how long it takes the callbacks to return, the result
     * array will be in the same order as passed in.
     * Only one callback is run at a time.
     *
     * @api public
     *
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (value, callback, index, array)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, resultArray)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.filterSeries(["apple", "pie", "tomato"], function (word, callback) {
     *     setTimeout(function () {
     *         callback(null, word.length % 2 === 1);
     *     }, word.length * 100);
     * }, function (err, result) {
     *     // woo, all done, should've taken roughly 1.4 seconds
     *     // result should be ["apple", "pie"]
     * })
     */
    concur.filterSeries = curry(filterLimit, 1);
    
    /**
     * A special token representing that an element is currently being reduced upon
     *
     * @api private
     */
    var IN_PROCESS = {};
    
    /**
     * Run an asynchronous reduce that iterates over the contents of an array and in
     * an asynchronous fashion, reduces adjacent elements until only one remains.
     * Unlike Array.prototype.reduce, there is no initialValue, as multiple
     * reductions will try to occur on the array concurrently. Assuming there is
     * no limit (or limit > log(num elements, 2)), the array will split into
     * multiple binary trees until the answer is apparent.
     * The ordering is preserved, so as long as the function is associative, this
     * will act without issue.
     *
     * @api public
     *
     * @param {Number} The amount of concurrent functions to allow at once
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (left, right, callback)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, result)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.reduceLimit(2, [1, 2, 3, 4, 5, 6, 7, 8], function (left, right, callback) {
     *     // this will receive (1, 2), (3, 4), (3, 7), (5, 6), (10, 11), (7, 8), (21, 15).
     *     // Or some other pattern, depending on how fast things run.
     *     setTimeout(function () {
     *         callback(null, left + right);
     *     }, (left + right) * 100);
     * }, function (err, result) {
     *     result === 36
     * })
     */
    var reduceLimit = concur.reduceLimit = function (limit, array, onValues, onComplete, thisArg) {
        limit >>>= 0; // coerce to UInt32
        if (limit <= 0) {
            limit = Infinity;
        }
        if (array == null) {
            throw new TypeError("array is null or undefined");
        }
        array = toObject(array);
        var length = array.length >>> 0; // coerce to UInt32
        if (typeof onValues !== "function") {
            throw new TypeError("onValues is not a function");
        }
        if (typeof onComplete !== "function") {
            throw new TypeError("onComplete is not a function");
        }
        if (length < 2) {
            onComplete.call(thisArg, null, array[0]);
            return;
        }
        
        var current = slice.call(array);
        var slotsUsed = 0;
        
        var broken = null;
        var synchronous = false;
        var next;
        var makeOnValuesCallback = function (leftIndex) {
            return once(function (err, value) {
                if (err && !broken) {
                    broken = err;
                }
                current[leftIndex] = value;
                --slotsUsed;
                if (!synchronous) {
                    next();
                }
            });
        };
        next = function () {
            while (!broken && slotsUsed < limit) {
                var leftIndex, right, rightIndex;
                for (leftIndex = 0; leftIndex < length; ++leftIndex) {
                    var left = current[leftIndex];
                    if (left !== IN_PROCESS && leftIndex in current) {
                        rightIndex = leftIndex + 1;
                        for (; rightIndex < length; ++rightIndex) {
                            right = current[rightIndex];
                            if (right === IN_PROCESS) {
                                break;
                            } else if (rightIndex in current) {
                                current[leftIndex] = IN_PROCESS;
                                delete current[rightIndex];
                                ++slotsUsed;
                                synchronous = true;
                                onValues.call(thisArg, left, right, makeOnValuesCallback(leftIndex));
                                synchronous = false;
                                
                                rightIndex = length;
                                break;
                            }
                        }
                    }
                }
                if (leftIndex >= length) {
                    // nothing left to do
                    break;
                }
            }
            if (slotsUsed === 0) {
                if (broken) {
                    onComplete.call(thisArg, broken === STOP ? null : broken, undefined);
                } else {
                    for (var i = 0; i < length; ++i) {
                        if (i in current) { // this should hit on likely 0 or one of the very low indexes
                            onComplete.call(thisArg, null, current[i]);
                            return;
                        }
                    }
                }
            }
        };
        next();
    };
    
    /**
     * Run an asynchronous reduce that iterates over the contents of an array and in
     * an asynchronous fashion, reduces adjacent elements until only one remains.
     * Unlike Array.prototype.reduce, there is no initialValue, as multiple
     * reductions will try to occur on the array concurrently. Since there is no
     * limit to the amount of concurrent callbacks, the array will split into
     * multiple binary trees until the answer is apparent.
     * The ordering is preserved, so as long as the function is associative, this
     * will act without issue.
     * All callbacks are run concurrently.
     *
     * @api public
     *
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (left, right, callback)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, result)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.reduce(2, [1, 2, 3, 4, 5, 6, 7, 8], function (left, right, callback) {
     *     // this will receive (1, 2), (3, 4), (5, 6), (7, 8), (3, 7), (11, 15), (10, 26)
     *     // Or some other pattern, depending on how fast things run.
     *     setTimeout(function () {
     *         callback(null, left + right);
     *     }, (left + right) * 100);
     * }, function (err, result) {
     *     result === 36
     * })
     */
    concur.reduce = curry(reduceLimit, 0);
    
    /**
     * Run an asynchronous reduce that iterates over the contents of an array and in
     * an asynchronous fashion, reduces adjacent elements until only one remains.
     * Unlike Array.prototype.reduce, there is no initialValue.
     *
     * @api public
     *
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (left, right, callback)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, result)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.reduceSeries(2, [1, 2, 3, 4, 5, 6, 7, 8], function (left, right, callback) {
     *     // this will receive (1, 2), (3, 3), (6, 4), (10, 5), (15, 6), (21, 7), (28, 8)
     *     setTimeout(function () {
     *         callback(null, left + right);
     *     }, (left + right) * 100);
     * }, function (err, result) {
     *     result === 36
     * })
     */
    concur.reduceSeries = curry(reduceLimit, 1);
    
    /**
     * Run an asynchronous reduce that iterates over the contents of an array and in
     * an asynchronous fashion, reduces adjacent elements until only one remains.
     * Unlike Array.prototype.reduce, there is no initialValue, as multiple
     * reductions will try to occur on the array concurrently. Assuming there is
     * no limit (or limit > log(num elements, 2)), the array will split into
     * multiple binary trees until the answer is apparent.
     * The ordering is preserved, so as long as the function is associative, this
     * will act without issue.
     * Unlike reduceLimit, this works from right-to-left rather than left-to-right.
     *
     * @api public
     *
     * @param {Number} The amount of concurrent functions to allow at once
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (left, right, callback)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, result)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.reduceRightLimit(2, [1, 2, 3, 4, 5, 6, 7, 8], function (left, right, callback) {
     *     // this will receive (7, 8), (5, 6), (11, 15), (4, 26), (2, 3), (5, 30), (1, 35)
     *     // Or some other pattern, depending on how fast things run.
     *     setTimeout(function () {
     *         callback(null, left + right);
     *     }, (left + right) * 100);
     * }, function (err, result) {
     *     result === 36
     * })
     */
    var reduceRightLimit = concur.reduceRightLimit = function (limit, array, onValues, onComplete, thisArg) {
        if (array == null) {
            throw new TypeError("array is null or undefined");
        }
        
        reduceLimit(limit, slice.call(array).reverse(), function (right, left, callback) {
            onValues.call(this, left, right, callback);
        }, onComplete, thisArg);
    };
    
    /**
     * Run an asynchronous reduce that iterates over the contents of an array and in
     * an asynchronous fashion, reduces adjacent elements until only one remains.
     * Unlike Array.prototype.reduce, there is no initialValue, as multiple
     * reductions will try to occur on the array concurrently. Since there is no
     * limit to the amount of concurrent callbacks, the array will split into
     * multiple binary trees until the answer is apparent.
     * The ordering is preserved, so as long as the function is associative, this
     * will act without issue.
     * Unlike reduce, this works from right-to-left rather than left-to-right,
     * but should be functionally equivalent.
     * All callbacks are run concurrently.
     *
     * @api public
     *
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (left, right, callback)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, result)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.reduceRight(2, [1, 2, 3, 4, 5, 6, 7, 8], function (left, right, callback) {
     *     // this will receive (7, 8), (5, 6), (3, 4), (1, 2), (11, 15), (3, 7), (10, 26)
     *     // Or some other pattern, depending on how fast things run.
     *     setTimeout(function () {
     *         callback(null, left + right);
     *     }, (left + right) * 100);
     * }, function (err, result) {
     *     result === 36
     * })
     */
    concur.reduceRight = curry(reduceRightLimit, 0);
    
    /**
     * Run an asynchronous reduce that iterates over the contents of an array and in
     * an asynchronous fashion, reduces adjacent elements until only one remains.
     * Unlike Array.prototype.reduce, there is no initialValue.
     * Unlike reduceSeries, this works from right-to-left rather than left-to-right.
     *
     * @api public
     *
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (left, right, callback)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, result)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.reduceSeries(2, [1, 2, 3, 4, 5, 6, 7, 8], function (left, right, callback) {
     *     // this will receive (7, 8), (6, 15), (5, 21), (4, 26), (3, 30), (2, 33), (1, 35)
     *     setTimeout(function () {
     *         callback(null, left + right);
     *     }, (left + right) * 100);
     * }, function (err, result) {
     *     result === 36
     * })
     */
    concur.reduceRightSeries = curry(reduceRightLimit, 1);
    
    /**
     * Run an asynchronous filter that iterates over the contents of an array
     * returns whether one of the elements passes a check.
     *
     * @api public
     *
     * @param {Number} The amount of concurrent functions to allow at once
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (value, callback, index, array)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, found)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.someLimit(2, ["apple", "pie", "tomato"], function (word, callback) {
     *     // though "apple" and "pie" are checked concurrently, "tomato" shouldn't be checked at all.
     *     setTimeout(function () {
     *         callback(null, word.length % 2 === 1);
     *     }, word.length * 100);
     * }, function (err, result) {
     *     // woo, all done, should've taken roughly 0.5 seconds
     *     // result should be true.
     * })
     */
    var someLimit = concur.someLimit = function (limit, array, onValue, onComplete, thisArg) {
        var result = false;
        forEachLimit(limit, array, function (value, callback, i, array) {
            onValue.call(this, value, once(function (err, check) {
                if (err) {
                    callback(err);
                } else if (check) {
                    result = true;
                    callback(STOP);
                } else {
                    callback(null);
                }
            }), i, array);
        }, function (err) {
            onComplete.call(this, err, err ? null : result);
        }, thisArg);
    };
    
    /**
     * Run an asynchronous filter that iterates over the contents of an array
     * returns whether one of the elements passes a check.
     * All callbacks are run concurrently.
     *
     * @api public
     *
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (value, callback, index, array)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, found)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.some(["apple", "pie", "tomato"], function (word, callback) {
     *     setTimeout(function () {
     *         callback(null, word.length % 2 === 1);
     *     }, word.length * 100);
     * }, function (err, result) {
     *     // woo, all done, should've taken roughly 0.6 seconds
     *     // result should be true.
     * })
     */
    concur.some = curry(someLimit, 0);
    
    /**
     * Run an asynchronous filter that iterates over the contents of an array
     * returns whether one of the elements passes a check.
     * Only one callback is run at a time.
     *
     * @api public
     *
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (value, callback, index, array)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, found)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.someSeries(["apple", "pie", "tomato"], function (word, callback) {
     *     // only "apple" is checked, then it immediately stops
     *     setTimeout(function () {
     *         callback(null, word.length % 2 === 1);
     *     }, word.length * 100);
     * }, function (err, result) {
     *     // woo, all done, should've taken roughly 0.5 seconds
     *     // result should be true.
     * })
     */
    concur.someSeries = curry(someLimit, 1);
    
    /**
     * Run an asynchronous filter that iterates over the contents of an array
     * returns whether all of the elements passes a check.
     *
     * @api public
     *
     * @param {Number} The amount of concurrent functions to allow at once
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (value, callback, index, array)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, found)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.everyLimit(2, ["apple", "pie", "tomato"], function (word, callback) {
     *     setTimeout(function () {
     *         callback(null, word.length % 2 === 1);
     *     }, word.length * 100);
     * }, function (err, result) {
     *     // woo, all done, should've taken roughly 0.9 seconds
     *     // result should be false.
     * })
     */
    var everyLimit = concur.everyLimit = function (limit, array, onValue, onComplete, thisArg) {
        var result = true;
        forEachLimit(limit, array, function (value, callback, i, array) {
            onValue.call(this, value, once(function (err, check) {
                if (err) {
                    callback(err);
                } else if (!check) {
                    result = false;
                    callback(STOP);
                } else {
                    callback(null);
                }
            }), i, array);
        }, function (err) {
            onComplete.call(this, err, err ? null : result);
        }, thisArg);
    };
    
    /**
     * Run an asynchronous filter that iterates over the contents of an array
     * returns whether all of the elements passes a check.
     * All callbacks are run concurrently.
     *
     * @api public
     *
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (value, callback, index, array)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, found)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.every(["apple", "pie", "tomato"], function (word, callback) {
     *     setTimeout(function () {
     *         callback(null, word.length % 2 === 1);
     *     }, word.length * 100);
     * }, function (err, result) {
     *     // woo, all done, should've taken roughly 0.6 seconds
     *     // result should be false.
     * })
     */
    concur.every = curry(everyLimit, 0);
    
    /**
     * Run an asynchronous filter that iterates over the contents of an array
     * returns whether all of the elements passes a check.
     * Only one callback is run at a time.
     *
     * @api public
     *
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (value, callback, index, array)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, found)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.everySeries(["apple", "pie", "tomato"], function (word, callback) {
     *     setTimeout(function () {
     *         callback(null, word.length % 2 === 1);
     *     }, word.length * 100);
     * }, function (err, result) {
     *     // woo, all done, should've taken roughly 1.4 seconds
     *     // result should be false.
     * })
     */
    concur.everySeries = curry(everyLimit, 1);
    
    /**
     * A sort function used by sortByLimit
     *
     * @api private
     *
     * @param {Array} An array that looks like [key, value]
     * @param {Array} An array that looks like [key, value]
     * @result {Number} One of -1, 0, or 1.
     */
    var sorter = function (left, right) {
        left = left[0];
        right = right[0];
        if (left < right) {
            return -1;
        } else if (left > right) {
            return 1;
        } else {
            return 0;
        }
    };
    
    /**
     * Sort an array by some value that is deduced through its callback.
     * Unlike Array.prototype.sort, this will return a new array rather than
     * update in-place.
     *
     * @api public
     *
     * @param {Number} The amount of concurrent functions to allow at once
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (value, callback, index, array)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, resultArray)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.sortByLimit(2, ["apple", "pie", "tomato"], function (word, callback) {
     *     setTimeout(function () {
     *         callback(null, word.length);
     *     }, word.length * 100);
     * }, function (err, result) {
     *     // woo, all done, should've taken roughly 0.9 seconds
     *     // result should be ["pie", "apple", "tomato"]
     * })
     */
    var sortByLimit = concur.sortByLimit = function (limit, array, onValue, onComplete, thisArg) {
        mapLimit(limit, array, function (item, callback, i, array) {
            onValue.call(this, item, once(function (err, value) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, [value, item]);
                }
            }), i, array);
        }, function (err, array) {
            if (err) {
                onComplete.call(this, err);
            } else {
                array.sort(sorter);
                for (var i = 0, len = array.length; i < len; ++i) {
                    var item = array[i];
                    if (!item) {
                        break;
                    }
                    array[i] = item[1];
                }
                onComplete.call(this, null, array);
            }
        }, thisArg);
    };
    
    /**
     * Sort an array by some value that is deduced through its callback.
     * Unlike Array.prototype.sort, this will return a new array rather than
     * update in-place.
     * All callbacks are run concurrently.
     *
     * @api public
     *
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (value, callback, index, array)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, resultArray)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.sortBy(["apple", "pie", "tomato"], function (word, callback) {
     *     setTimeout(function () {
     *         callback(null, word.length);
     *     }, word.length * 100);
     * }, function (err, result) {
     *     // woo, all done, should've taken roughly 0.6 seconds
     *     // result should be ["pie", "apple", "tomato"]
     * })
     */
    concur.sortBy = curry(sortByLimit, 0);
    
    /**
     * Sort an array by some value that is deduced through its callback.
     * Unlike Array.prototype.sort, this will return a new array rather than
     * update in-place.
     * Only one callback is run at a time.
     *
     * @api public
     *
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call once per value. Parameters are (value, callback, index, array)
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, resultArray)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.sortBySeries(["apple", "pie", "tomato"], function (word, callback) {
     *     setTimeout(function () {
     *         callback(null, word.length);
     *     }, word.length * 100);
     * }, function (err, result) {
     *     // woo, all done, should've taken roughly 1.4 seconds
     *     // result should be ["pie", "apple", "tomato"]
     * })
     */
    concur.sortBySeries = curry(sortByLimit, 1);
    
    /**
     * Call an array of functions concurrently, placing the results of each in
     * an ordered array. If an element is a non-function, it is skipped.
     * 
     * @api public
     *
     * @param {Number} The amount of concurrent functions to allow at once
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, value)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.execute(5, funcs, function (err, resultArray) {
     *     // woo, all done
     * })
     */
    var execute = concur.execute = function (limit, array, onComplete, thisArg) {
        mapLimit(limit, array, function (item, callback, i, array) {
            if (typeof item === "function") {
                item.call(this, callback, i, array);
            } else {
                callback(null, DELETE);
            }
        }, function (err, array) {
            onComplete.call(this, err, array);
        }, thisArg);
    };
    
    /**
     * Call an array of functions concurrently, placing the results of each in
     * an ordered array. If an element is a non-function, it is skipped.
     * All callbacks are run concurrently.
     * 
     * @api public
     *
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, value)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.parallel(5, funcs, function (err, resultArray) {
     *     // woo, all done
     * })
     */
    concur.parallel = curry(execute, 0);
    
    /**
     * Call an array of functions concurrently, placing the results of each in
     * an ordered array. If an element is a non-function, it is skipped.
     * Only one callback is run at a time.
     * 
     * @api public
     *
     * @param {Array} The array-like structure to iterate over
     * @param {Function} A function to call when an error occurs or all values have been iterated through. Parameters are (error, value)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.series(5, funcs, function (err, resultArray) {
     *     // woo, all done
     * })
     */
    concur.series = curry(execute, 1);
    
    /**
     * Repeatedly alternate between calling synchronous test and asynchronous
     * onIteration for as long as test returns a truthy value.
     * The result value of onIteration is stored and passed in each time, to
     * allow for continuous generation.
     *
     * @param {Function} A synchronous function that should return a truthy or falsy value. Parameters are (lastResult, index).
     * @param {Function} A function that will be called each iteration. Parameters are (callback, lastResult, index).
     * @param {Function} A function to call when an error occurs or test finally returns false. Parameters are (error, value)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.whilst(function (value) {
     *     return !value || value < 10;
     * }, function (callback, value) {
     *     setTimeout(function () {
     *         callback(null, (value || 0) + 1);
     *     }, value * 100)
     * }, function (err, value) {
     *     // woo, all done
     * })
     */
    var while_ = concur.whilst = concur["while"] = function (test, onIteration, onComplete, thisArg) {
        var i = 0;
        var result;
        var broken = null;
        var running = false;
        var synchronous = false;
        var next;
        var onIterationCallback = function (err, value) {
            if (err && !broken) {
                broken = err;
            }
            running = false;
            result = value;
            if (!synchronous) {
                next();
            }
        };
        next = function () {
            while (!running && !broken && test.call(thisArg, result, i)) {
                running = true;
                synchronous = true;
                onIteration.call(thisArg, once(onIterationCallback), result, i);
                synchronous = false;
            }
            if (!running) {
                onComplete.call(thisArg, broken, result);
            }
            ++i;
        };
        next();
    };
    
    /**
     * Repeatedly alternate between calling synchronous test and asynchronous
     * onIteration for as long as test returns a falsy value.
     * The result value of onIteration is stored and passed in each time, to
     * allow for continuous generation.
     *
     * @param {Function} A synchronous function that should return a truthy or falsy value. Parameters are (lastResult, index).
     * @param {Function} A function that will be called each iteration. Parameters are (callback, lastResult, index).
     * @param {Function} A function to call when an error occurs or test finally returns false. Parameters are (error, value)
     * @param {any} A value to pass in as the 'this' value for all callbacks
     * @example
     * concur.until(function (value) {
     *     return value > 10;
     * }, function (callback, value) {
     *     setTimeout(function () {
     *         callback(value + 1);
     *     }, value * 100)
     * }, function (err, value) {
     *     // woo, all done
     * })
     */
    concur.until = function (test, onIteration, onComplete, thisArg) {
        while_(function (result, i) {
            return !test.call(this, result, i);
        }, onIteration, onComplete, thisArg);
    };
    
    /**
     * the cacheKey generator if one is not provided to concur.memoize
     *
     * @api private
     *
     * @param {any} The first argument passed in
     * @result {String} The string representation of the first argument
     */
    var standardGetCacheKey = function (x) {
        return "" + x;
    };
    
    /**
     * Cache the results of an asynchronous function, while maintaining its calling pattern.
     * The resultant function has a method "clear" on it, which will empty the internal cache.
     *
     * @api public
     *
     * @param {Function} A function that should have the parameters (...args, callback, ...otherArgs)
     * @param {Number} The index which the callback should occur in the function signature
     * @param {Function} (Optional) A fast, synchronous function that should return a unique hash code based on the provided arguments (sans callback)
     * @returns {Function} A function which when called with the same arguments two or more times, should rely on a cache for any subsequent calls.
     *
     * @example
     * var square = concur.memoize(function (value, callback) {
     *     setTimeout(function () {
     *         callback(null, value * value);
     *     }, value * 100)
     * }, 1);
     * square(4, function (err, value) {
     *     // should've taken roughly 400 ms
     *     value == 16;
     *     square(4, function (err, value) {
     *         // instant
     *         value == 16;
     *     })
     * })
     *
     * @example
     * concur.forEachSeries(["a", "b", "a", "b", "a", "b"], concur.memoize(function (value, callback) {
     *     setTimeout(function () {
     *         // do something here
     *     }, 1000)
     * }, 1), function (err) {
     *     // only took 2 seconds rather than 6
     * })
     */
    concur.memoize = function (func, index, getCacheKey) {
        if (!getCacheKey) {
            getCacheKey = standardGetCacheKey;
        }
        
        var cache = {};
        var resultFunc = function () {
            var args = slice.call(arguments);
            var callback = args.splice(index, 1)[0];
            if (typeof callback !== "function") {
                throw new TypeError("Expected argument #" + index + " to be a function");
            }
            var cacheKey = getCacheKey.apply(this, args);
            if (has.call(cache, cacheKey)) {
                callback.apply(this, cache[cacheKey]);
            } else {
                args.splice(index, 0, function () {
                    if (!has.call(cache, cacheKey)) {
                        cache[cacheKey] = slice.call(arguments);
                    }
                    callback.apply(this, cache[cacheKey]);
                });
                func.apply(this, args);
            }
        };
        resultFunc.clear = function () {
            cache = {};
        };
        return resultFunc;
    };
    
    /**
     * Throttle a function such that it is not called more often than the
     * specified delayInMilliseconds.
     * If omitLast is falsy, then a callback may be queued up to be called.
     * If someone triggers the function twice within 10 ms, and the
     * delayInMilliseconds is 1000 ms, then it will be run immediately the
     * first time, but then queued up and run once in 1000 ms.
     * If omitLast is truthy, then the callback invocation requires an actual
     * call and no queuing occurs.
     *
     * This can be handy for something like a repeated event such as a window
     * resize.
     *
     * @api public
     *
     * @param {Number} The amount of time between allowable calls in milliseconds
     * @param {Boolean} (Optional) Whether or not to omit the end function call.
     * @param {Function} The function to throttle
     * @returns {Function} The throttled function
     * @example
     * var f = concur.throttle(1000, function () {
     *     // do something
     * });
     * f(); // calls internal function immediately
     * setTimeout(f, 100); // will queue up to run in 900 ms
     * setTimeout(f, 200); // does nothing, already queued
     */
    concur.throttle = function (delayInMilliseconds, omitLast, callback) {
        if (typeof omitLast === "function") {
            callback = omitLast;
            omitLast = false;
        }
        var lastCallTime = 0;
        var lastPending = false;
        return function () {
            if (!lastPending) {
                var now = +new Date();
                if (lastPending || now - lastCallTime > delayInMilliseconds) {
                    lastCallTime = now;
                    callback.apply(this, slice.call(arguments));
                } else if (!omitLast) {
                    lastPending = true;
                    var this_ = this;
                    var args = slice.call(arguments);
                    setTimeout(function () {
                        lastPending = false;
                        callback.apply(this_, args);
                    }, delayInMilliseconds - now + lastCallTime);
                }
            }
        };
    };
    
    /**
     * Throttle a function such that it will not be called until the callback
     * is no longer repeatedly called within a the provided timeframe.
     * If includeFirst is truthy, then the first time the function is called,
     * the callback will also be called.
     *
     * This can be handy for something like a keypress event where you don't
     * want to do any calculations until the user has stopped typing.
     *
     * @api public
     *
     * @param {Number} The amount of time between calls to consider it "repetitive"
     * @param {Boolean} (Optional) Whether to call the callback on the first call.
     * @param {Function} The function to throttle
     * @returns {Function} The throttled function
     * @example
     * var f = concur.debounce(200, function () {
     *     // do something
     * });
     * f(); // queued up to fire in 200 ms
     * setTimeout(f, 50); // requeue, push back another 50 ms
     * setTimeout(f, 150); // requeue, push back another 100 ms
     * setTimeout(f, 300); // requeue, push back another 150 ms
     * // eventually called at the 500 ms mark.
     */
    concur.debounce = function (delayInMilliseconds, includeFirst, callback) {
        if (typeof includeFirst === "function") {
            callback = includeFirst;
            includeFirst = false;
        }
        var timeoutId = null;
        return function () {
            if (!timeoutId && includeFirst) {
                callback.apply(this, slice.call(arguments));
            }
            var this_ = this;
            var args = slice.call(arguments);
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(function () {
                timeoutId = null;
                callback.apply(this_, args);
            }, delayInMilliseconds);
        };
    };
    
    /**
     * Execute a single callback after a specified delayInMilliseconds.
     * Although this eventually defers to setTimeout, the callback is required
     * to be a function, and not a string.
     *
     * @api public
     *
     * @param {Number} The amount of time to sleep for.
     * @param {Function} A function to call after the time has elapsed.
     * @param {any} A value to pass in as the 'this' value for the callback
     * @example
     * concur.sleep(200, function () {
     *     // hey, it's 200 ms later
     * });
     * @example
     * concur.sleep(200, function () {
     *     this == myValue;
     * }, myValue);
     */
    concur.sleep = function (delayInMilliseconds, callback, thisArg) {
        if (typeof callback !== "function") {
            throw new TypeError("callback must be a function");
        }
        
        if (delayInMilliseconds === 0) {
            nextTick(callback, thisArg);
        } else if (thisArg != null) {
            setTimeout(function () {
                callback.call(thisArg);
            }, delayInMilliseconds);
        } else {
            setTimeout(callback, delayInMilliseconds);
        }
    };
}(this));
