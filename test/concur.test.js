/*jshint strict: false */
/*global setTimeout: false */

var assert = require("assert"),
    concur = require("../index");

var arrayEq = function (expected, actual) {
    assert.strictEqual(true, actual instanceof Array);
    assert.strictEqual(expected.length, actual.length);
    for (var i = 0, length = actual.length; i < length; i += 1) {
        assert.strictEqual(expected[i], actual[i]);
    }
};

var exampleArray = ["a", "b", "c", "d", "e", "f"];

var randomTicks = function (callback) {
    var remaining = Math.floor(Math.random() * 6) + 1;
    var handler = function () {
        if (remaining === 0) {
            callback();
        } else {
            remaining -= 1;
            concur.nextTick(handler);
        }
    };
    handler();
};
var assertRanFinish = function (callback, timeout) {
    if (!timeout) {
        timeout = 1000;
    }
    var start = +new Date();
    var handler = function () {
        if (callback()) {
            return;
        } else if (+new Date() - start > timeout) {
            assert.fail();
        } else {
            setTimeout(handler, 50);
        }
    };
    handler();
};

module.exports = {
    "nextTick": function () {
        var ran = false;
        concur.nextTick(function () {
            assert.strictEqual(false, ran);
            ran = true;
        });
        
        setTimeout(function () {
            assert.strictEqual(true, ran);
        }, 50);
    },
    
    "rangeLimit": function () {
        var started = [];
        var ranFinish = false;
        concur.rangeLimit(3, 0, 6, function (i, callback) {
            started.push(i);
            assert.strictEqual(i + 1, started.length);
            concur.nextTick(function () {
                if (i < 3) {
                    arrayEq([0, 1, 2], started);
                } else {
                    arrayEq([0, 1, 2, 3, 4, 5], started);
                }
                concur.nextTick(callback);
            });
        }, function (err) {
            assert.equal(null, err);
            arrayEq([0, 1, 2, 3, 4, 5], started);
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "range": function () {
        var started = [];
        var ranFinish = false;
        concur.range(0, 6, function (i, callback) {
            started.push(i);
            assert.strictEqual(i + 1, started.length);
            concur.nextTick(function () {
                assert.strictEqual(6, started.length);
                callback();
            });
        }, function (err) {
            assert.equal(null, err);
            arrayEq([0, 1, 2, 3, 4, 5], started);
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "rangeSeries": function () {
        var started = [];
        var ranFinish = false;
        concur.rangeSeries(0, 6, function (i, callback) {
            started.push(i);
            assert.strictEqual(i + 1, started.length);
            concur.nextTick(function () {
                assert.strictEqual(i + 1, started.length);
                callback();
            });
        }, function (err) {
            assert.equal(null, err);
            arrayEq([0, 1, 2, 3, 4, 5], started);
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "rangeLimit with error": function () {
        var started = [];
        var error = {};
        var ranFinish = false;
        concur.rangeLimit(3, 0, 6, function (i, callback) {
            started.push(i);
            assert.strictEqual(i + 1, started.length);
            concur.nextTick(function () {
                arrayEq([0, 1, 2], started);
                callback(error);
            });
        }, function (err) {
            assert.equal(error, err);
            arrayEq([0, 1, 2], started);
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "when error occurs, it does not call final callback until all normal callbacks are called first": function () {
        var started = [];
        var done = [];
        var error = {};
        var ranFinish = false;
        concur.rangeLimit(3, 0, 6, function (i, callback) {
            started.push(i);
            assert.strictEqual(i + 1, started.length);
            concur.nextTick(function () {
                arrayEq([0, 1, 2], started);
                if (i < 2) {
                    concur.nextTick(function () {
                        done.push(i);
                        callback();
                    });
                } else {
                    callback(error);
                }
            });
        }, function (err) {
            assert.equal(error, err);
            arrayEq([0, 1, 2], started);
            arrayEq([0, 1], done.sort());
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "forEachLimit": function () {
        var i = 0;
        var started = [];
        var ranFinish = false;
        concur.forEachLimit(2, exampleArray, function (value, callback, index, array) {
            started.push(value);
            assert.strictEqual(i, index);
            i += 1;
            assert.strictEqual(exampleArray, array);
            arrayEq(exampleArray.slice(0, index + 1), started);
            concur.nextTick(function () {
                if (index % 2 === 0) {
                    arrayEq(exampleArray.slice(0, index + 2), started);
                } else {
                    arrayEq(exampleArray.slice(0, index + 1), started);
                }
                concur.nextTick(callback);
            });
        }, function (err) {
            arrayEq(exampleArray, started);
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "mapLimit": function () {
        var i = 0;
        var started = [];
        var ranFinish = false;
        concur.mapLimit(2, exampleArray, function (value, callback, index, array) {
            started.push(value);
            assert.strictEqual(i, index);
            i += 1;
            assert.strictEqual(exampleArray, array);
            arrayEq(exampleArray.slice(0, index + 1), started);
            randomTicks(function () {
                callback(null, value.toUpperCase());
            });
        }, function (err, result) {
            arrayEq(exampleArray.map(function (x) {
                return x.toUpperCase();
            }), result);
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "filterLimit": function () {
        var i = 0;
        var started = [];
        var ranFinish = false;
        concur.filterLimit(2, exampleArray, function (value, callback, index, array) {
            started.push(value);
            assert.strictEqual(i, index);
            i += 1;
            assert.strictEqual(exampleArray, array);
            arrayEq(exampleArray.slice(0, index + 1), started);
            randomTicks(function () {
                callback(null, value.charCodeAt(0) % 2);
            });
        }, function (err, result) {
            arrayEq(exampleArray.filter(function (x) {
                return x.charCodeAt(0) % 2;
            }), result);
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "reduceLimit": function () {
        var ranFinish = false;
        concur.reduceLimit(2, exampleArray, function (left, right, callback) {
            randomTicks(function () {
                callback(null, left + right);
            });
        }, function (err, result) {
            assert.equal(null, err);
            assert.strictEqual(exampleArray.join(""), result);
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "reduceRightLimit": function () {
        var ranFinish = false;
        concur.reduceRightLimit(2, exampleArray, function (left, right, callback) {
            randomTicks(function () {
                callback(null, left + right);
            });
        }, function (err, result) {
            assert.equal(null, err);
            assert.strictEqual(exampleArray.join(""), result);
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "someLimit": function () {
        var ranFinish = false;
        var count = 0;
        concur.someLimit(2, exampleArray, function (value, callback) {
            count += 1;
            randomTicks(function () {
                callback(null, value > "c");
            });
        }, function (err, result) {
            assert.equal(null, err);
            assert.strictEqual(true, result);
            assert.ok(count <= 5);
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "someLimit, always true": function () {
        var ranFinish = false;
        var count = 0;
        concur.someLimit(2, exampleArray, function (value, callback) {
            count += 1;
            randomTicks(function () {
                callback(null, true);
            });
        }, function (err, result) {
            assert.equal(null, err);
            assert.strictEqual(true, result);
            assert.strictEqual(2, count);
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "someLimit, always false": function () {
        var ranFinish = false;
        var count = 0;
        concur.someLimit(2, exampleArray, function (value, callback) {
            count += 1;
            randomTicks(function () {
                callback(null, false);
            });
        }, function (err, result) {
            assert.equal(null, err);
            assert.strictEqual(false, result);
            assert.strictEqual(6, count);
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "everyLimit": function () {
        var ranFinish = false;
        var count = 0;
        concur.everyLimit(2, exampleArray, function (value, callback) {
            count += 1;
            randomTicks(function () {
                callback(null, value <= "c");
            });
        }, function (err, result) {
            assert.equal(null, err);
            assert.strictEqual(false, result);
            assert.ok(count <= 5);
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "everyLimit, always false": function () {
        var ranFinish = false;
        var count = 0;
        concur.everyLimit(2, exampleArray, function (value, callback) {
            count += 1;
            randomTicks(function () {
                callback(null, false);
            });
        }, function (err, result) {
            assert.equal(null, err);
            assert.strictEqual(false, result);
            assert.strictEqual(2, count);
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
       
    "everyLimit, always true": function () {
        var ranFinish = false;
        var count = 0;
        concur.everyLimit(2, exampleArray, function (value, callback) {
            count += 1;
            randomTicks(function () {
                callback(null, true);
            });
        }, function (err, result) {
            assert.equal(null, err);
            assert.strictEqual(true, result);
            assert.strictEqual(6, count);
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "sortByLimit": function () {
        var ranFinish = false;
        var arr = [1, 5, 3];
        concur.sortByLimit(2, arr, function (value, callback) {
            randomTicks(function () {
                callback(null, value * value);
            });
        }, function (err, result) {
            assert.equal(null, err);
            arrayEq([1, 3, 5], result);
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "execute": function () {
        var ranFinish = false;
        var arr = [];
        var func = function (callback, index) {
            randomTicks(function () {
                callback(null, index);
            });
        };
        for (var i = 0; i < 10; i += 1) {
            arr.push(func);
        }
        concur.execute(2, arr, function (err, result) {
            assert.equal(null, err);
            arrayEq([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], result);
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "whilst": function () {
        var ranFinish = false;
        concur.whilst(function (value) {
            return !value || value < 10;
        }, function (callback, value) {
            randomTicks(function () {
                callback(null, (value || 0) + 1);
            });
        }, function (err, value) {
            assert.strictEqual(10, value);
            ranFinish = true;
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "memoize": function () {
        var hit = [];
        var func = concur.memoize(function (key, callback) {
            assert.strictEqual(-1, hit.indexOf(key));
            hit.push(key);
            randomTicks(function () {
                return callback(null, key);
            });
        }, 1);
        var ranFinish = false;
        func("alpha", function (err, value) {
            assert.equal(null, err);
            assert.strictEqual("alpha", value);
            
            randomTicks(function () {
                func("alpha", function (err, value) {
                    assert.equal(null, err);
                    assert.strictEqual("alpha", value);
                    ranFinish = true;
                });
            });
        });
        assertRanFinish(function () {
            return ranFinish;
        });
    },
    
    "throttle": function () {
        var times = [];
        var f = concur.throttle(300, function () {
            times.push(+new Date());
        });
        f(); // calls internal function immediately
        setTimeout(f, 100); // will queue up to run in 200 ms
        setTimeout(f, 200); // does nothing, already queued
        setTimeout(function () {
            assert.strictEqual(2, times.length);
            assert.ok(Math.abs(times[1] - times[0] - 300) < 50);
        }, 350);
    },
    
    "throttle with omitLast": function () {
        var times = [];
        var f = concur.throttle(300, true, function () {
            times.push(+new Date());
        });
        f(); // calls internal function immediately
        setTimeout(f, 100); // will queue up to run in 200 ms
        setTimeout(f, 200); // does nothing, already queued
        setTimeout(function () {
            assert.strictEqual(1, times.length);
            f();
            assert.strictEqual(2, times.length);
        }, 350);
    },
    
    "debounce": function () {
        var times = [];
        var f = concur.debounce(300, function () {
            times.push(+new Date());
        });
        var start = +new Date();
        f(); // queued up to fire in 300 ms
        setTimeout(f, 100); // requeue, push back another 100 ms
        setTimeout(f, 200); // requeue, push back another 100 ms
        setTimeout(function () {
            assert.strictEqual(1, times.length);
            assert.ok(Math.abs(times[0] - start - 500) < 50);
        }, 550);
    },
    
    "debounce with includeFirst": function () {
        var times = [];
        var f = concur.debounce(300, true, function () {
            times.push(+new Date());
        });
        f(); // calls internal function immediately
        setTimeout(f, 100); // requeue, push back another 100 ms
        setTimeout(f, 200); // requeue, push back another 100 ms
        setTimeout(function () {
            assert.strictEqual(2, times.length);
            assert.ok(Math.abs(times[1] - times[0] - 500) < 50);
        }, 550);
    }
};