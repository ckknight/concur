# Concur

  Concur is a relatively robust set of asynchrony and concurrency helpers that should make handling of asynchronous code and multiple concurrent requests easier to deal with.
  
  It tries to stick to the standard node.js-style callback format of `callback(err, value)` where if an error occurs, it is passed as the first argument, and if it does not, then null or undefined is passed as the first argument.
  
  If in any case, an error does occur, all current callbacks will be allowed to finish, then the `onComplete` will be called, so as to prevent any race conditions.

## Issues

  If you find any issues with Concur or have any suggestions or feedback, please feel free to visit the [github
  issues](https://github.com/ckknight/concur/issues) page.

## forEach
  There are three forms of `forEach`, as there are with most functions of `concur`. They all apply a callback to each element in the provided array, the concurrency is the only difference.
  
  - `forEach(array, onValue, onComplete, thisArg)`: Apply a callback to every item, fully parallel
  - `forEachSeries(array, onValue, onComplete, thisArg)`: Apply a callback to the first item until completion, then the second, and so on.
  - `forEachLimit(limit, array, onValue, onComplete, thisArg)`: Apply a callback to the first `limit` items, always trying to keep `limit` running until exhausted.

### Arguments
  * `limit` - the maximum amount of concurrency requested.
  * `array` - an Array-like object to iterate over.
  * `onValue(value, callback(err), index, array)` - a function that will be run for each value in the array.
  * `onComplete(err)` - a function that will be run on completion or when an error is provided.
  * `thisArg` - a value that will be passed in as the `this` argument to all callbacks.

### Example
    concur.forEach([1, 2, 3, 4], function (value, callback) {
        setTimeout(function () {
          callback();
        }, value * 1000);
    }, function (err) {
        if (err) {
            throw err;
        }
        // do something now
    });

## map
  Creates a new array with the results of calling a provided function on every element of the provided array.
  Regardless of the level of requested concurrency, the resultant array will be properly in-order.
  
  - `map(array, onValue, onComplete, thisArg)`: Fully parallel
  - `mapSeries(array, onValue, onComplete, thisArg)`: One-at-a-time
  - `mapLimit(limit, array, onValue, onComplete, thisArg)`: Up to `limit` at a time

### Arguments
  * `limit` - the maximum amount of concurrency requested.
  * `array` - an Array-like object to iterate over.
  * `onValue(value, callback(err, newValue), index, array)` - a function that will be run for each value in the array.
  * `onComplete(err, newArray)` - a function that will be run on completion or when an error is provided.
  * `thisArg` - a value that will be passed in as the `this` argument to all callbacks.

### Example
    concur.map([1, 2, 3, 4], function (value, callback) {
        setTimeout(function () {
            callback(null, value * value);
        }, Math.random() * 1000)
    }, function (err, result) {
        if (err) {
            throw err;
        }
        // result is [1, 4, 9, 16], regardless of when each callback completed.
    });

## filter
  Creates a new array with all the elements that pass the test implemented by the provided function.
  Regardless of the level of requested concurrency, the resultant array will be properly in-order.
  
  - `filter(array, onValue, onComplete, thisArg)`: Fully parallel
  - `filterSeries(array, onValue, onComplete, thisArg)`: One-at-a-time
  - `filterLimit(limit, array, onValue, onComplete, thisArg)`: Up to `limit` at a time

### Arguments
  * `limit` - the maximum amount of concurrency requested.
  * `array` - an Array-like object to iterate over.
  * `onValue(value, callback(err, pass), index, array)` - a function that will be run for each value in the array.
  * `onComplete(err, newArray)` - a function that will be run on completion or when an error is provided.
  * `thisArg` - a value that will be passed in as the `this` argument to all callbacks.

### Example
    concur.filter([1, 2, 3, 4], function (value, callback) {
        setTimeout(function () {
            callback(null, value % 2 == 0);
        }, Math.random() * 1000)
    }, function (err, result) {
        if (err) {
            throw err;
        }
        // result is [2, 4], regardless of when each callback completed.
    });

## reduce and reduceRight
  Apply a function against every two neighboring values in an array so as to reduce it to a single value.
  Unlike `Array.prototype.reduce`, this does not take an accumulator, as it is meant to be run with concurrency in mind.
  If run in parallel, a series of binary trees will be produced and calculated concurrently.
  If reduceRight is used instead, it will work from right-to-left rather than left-to-right.
  
  - `reduce(array, onValues, onComplete, thisArg)`: Fully parallel, left-to-right
  - `reduceSeries(array, onValues, onComplete, thisArg)`: One-at-a-time, left-to-right
  - `reduceLimit(limit, array, onValues, onComplete, thisArg)`: Up to `limit` at a time, left-to-right
  
  - `reduceRight(array, onValues, onComplete, thisArg)`: Fully parallel, right-to-left
  - `reduceRightSeries(array, onValues, onComplete, thisArg)`: One-at-a-time, right-to-left
  - `reduceRightLimit(limit, array, onValues, onComplete, thisArg)`: Up to `limit` at a time, right-to-left

### Arguments
  * `limit` - the maximum amount of concurrency requested.
  * `array` - an Array-like object to iterate over.
  * `onValues(left, right, callback(err, value))` - a function that will be run for each neighboring values in the array.
  * `onComplete(err, result)` - a function that will be run on completion or when an error is provided.
  * `thisArg` - a value that will be passed in as the `this` argument to all callbacks.

### Example
    concur.reduce(["h", "e", "l", "l", "o"], function (left, right, callback) {
        setTimeout(function () {
            callback(null, left + right);
        }, Math.random() * 1000)
    }, function (err, result) {
        if (err) {
            throw err;
        }
        // result is "hello"
    });

## some and every
  Test whether either some element or every element in an array passes the test implemented by the provided function.
  Since the iteration can break early, it is recommended to use the `limit` versions rather than the fully-parallel versions.
  
  - `some(array, onValue, onComplete, thisArg)`: Fully parallel
  - `someSeries(array, onValue, onComplete, thisArg)`: One-at-a-time
  - `someLimit(limit, array, onValue, onComplete, thisArg)`: Up to `limit` at a time
  
  - `everyRight(array, onValues, onComplete, thisArg)`: Fully parallel
  - `everyRightSeries(array, onValues, onComplete, thisArg)`: One-at-a-time
  - `everyRightLimit(limit, array, onValues, onComplete, thisArg)`: Up to `limit` at a time

### Arguments
  * `limit` - the maximum amount of concurrency requested.
  * `array` - an Array-like object to iterate over.
  * `onValue(value, callback(err, pass))` - a function that will be run for each value in the array.
  * `onComplete(err, pass)` - a function that will be run on completion or when an error is provided.
  * `thisArg` - a value that will be passed in as the `this` argument to all callbacks.

### Example
    concur.someLimit(2, [1, 2, 3, 4], function (left, right, callback) {
        setTimeout(function () {
            callback(null, value % 2 == 0);
        }, Math.random() * 1000)
    }, function (err, pass) {
        if (err) {
            throw err;
        }
        // result is true
    });
    
    concur.everyLimit(2, [1, 2, 3, 4], function (left, right, callback) {
        setTimeout(function () {
            callback(null, value % 2 == 0);
        }, Math.random() * 1000)
    }, function (err, pass) {
        if (err) {
            throw err;
        }
        // result is false
    });

## sortBy
  Sort the elements of an array. This works by calculating the sort value and then running a standard `Array.prototype.sort`. Unlike `Array.prototype.sort`, the array is not altered in-place, but a new array is created.
  
  - `sortBy(array, onValue, onComplete, thisArg)`: Fully parallel
  - `sortBySeries(array, onValue, onComplete, thisArg)`: One-at-a-time
  - `sortByLimit(limit, array, onValue, onComplete, thisArg)`: Up to `limit` at a time

### Arguments
  * `limit` - the maximum amount of concurrency requested.
  * `array` - an Array-like object to iterate over.
  * `onValue(value, callback(err, sortValue), index, array)` - a function that will be run for each value in the array.
  * `onComplete(err, sortedArray)` - a function that will be run on completion or when an error is provided.
  * `thisArg` - a value that will be passed in as the `this` argument to all callbacks.

### Example
    concur.sortBy(["monkey", "tuba", "refridgerator"], function (word, callback) {
        setTimeout(function () {
            callback(null, word.length);
        }, Math.random() * 1000)
    }, function (err, result) {
        if (err) {
            throw err;
        }
        // result is ["tuba", "monkey", "refridgerator"]
    });

## range
  Execute a callback for a range of values.
  
  - `range(start, finish, onValue, onComplete, thisArg)`: Fully parallel
  - `rangeSeries(start, finish, onValue, onComplete, thisArg)`: One-at-a-time
  - `rangeLimit(limit, start, finish, onValue, onComplete, thisArg)`: Up to `limit` at a time

### Arguments
  * `limit` - the maximum amount of concurrency requested.
  * `start` - the starting value
  * `finish` - the finishing value, exclusive
  * `onValue(value, callback(err), index, array)` - a function that will be run for each value in the range.
  * `onComplete(err)` - a function that will be run on completion or when an error is provided.
  * `thisArg` - a value that will be passed in as the `this` argument to all callbacks.

### Example
    concur.range(1, 100, function (value, callback) {
        setTimeout(function () {
          callback();
        }, value * 1000);
    }, function (err) {
        if (err) {
            throw err;
        }
        // do something now
    });

## parallel, series, and execute
  Execute an array of functions in-order based on the concurrency of the function called. The passed-in values to the callbacks will be placed in an array (in-order) and provided to `onComplete`, but it can be safely ignored if it is irrelevant to the problem at hand.
  
  - `parallel(array, onComplete, thisArg)`: Fully parallel
  - `series(array, onComplete, thisArg)`: One-at-a-time
  - `execute(limit, array, onComplete, thisArg)`: Up to `limit` at a time

### Arguments
  * `limit` - the maximum amount of concurrency requested.
  * `array` - an Array of functions. The functions should have the signature `(callback(err, value), index, array)`.
  * `onValue(value, callback(err, newValue), index, array)` - a function that will be run for each value in the array.
  * `onComplete(err, newArray)` - a function that will be run on completion or when an error is provided.
  * `thisArg` - a value that will be passed in as the `this` argument to all callbacks.

### Example
    concur.execute(2, [
        function (callback) {
            setTimeout(function () {
                callback("a")
            }, Math.random() * 1000)
        },
        function (callback) {
            setTimeout(function () {
                callback("b")
            }, Math.random() * 1000)
        },
        function (callback) {
            setTimeout(function () {
                callback("c")
            }, Math.random() * 1000)
        },
        function (callback) {
            setTimeout(function () {
                callback("d")
            }, Math.random() * 1000)
        },
    ], function (err, array) {
        if (err) {
            throw err;
        }
        // array is ["a", "b", "c", "d"], regardless of when each callback completed.
    });

## whilst (or while) and until
  Execute an asynchronous function repeatedly while a synchronous test function returns a truthy (or falsy for `until`) value.
  `while` is provided as well as `whilst` (they are aliases), but some JavaScript interpreters can't interpret `concur.while` properly, and `concur["while"]` would be necessary. If you use a compile-to-javascript language like CoffeeScript or UglifyJS, you should not have any problems.
  A value can be provided to `onIteration`'s callback, to save state. Said state is initially `undefined`.
  
  - `while or whilst(test, onIteration, onComplete, thisArg)`
  - `until(test, onIteration, onComplete, thisArg)`

### Arguments
  * `test(state, index)` - a synchronous test that should return a falsy or truthy value whether to continue or not.
  * `onIteration(callback(err, newState), state, index)` - a function that will be run for each iteration.
  * `onComplete(err, state)` - a function that will be run on completion or when an error is provided.
  * `thisArg` - a value that will be passed in as the `this` argument to all callbacks.

### Example
    concur.whilst(function (state) {
        return state === undefined || state < 5;
    }, function (callback, state) {
        if (state === undefined) {
            state = 0;
        }
        setTimeout(function () {
            callback(null, state + 1);
        }, Math.random() * 1000)
    }, function (err, state) {
        if (err) {
          throw err;
        }
        // state should be 5
    });

## memoize
  Cache the results of an asynchronous function such that if it is called with the same arguments, then it would not have to calculate its result value again.

### Arguments
  * `func(..., callback, ...)` - the function to memoize
  * `index` - the index of the callback of `func`. Zero-indexed.
  * `getCacheKey(...)` - (optional) a function to return a "unique" string to use as the cache key. If not provided, returns the string value of the first argument.

### Example
    var func = concur.memoize(function (value, callback) {
        setTimeout(function () {
            callback(null, value * value);
        }, Math.random() * 1000)
    }, 1);
    
    func(5, function (err, value) {
        value === 25; // up to a second later
        func(5, function (err, value) {
            value === 25; // immediately
        });
    });
    func.clear(); // clear the cache, if I so choose

## throttle and debounce
  Throttle a function to not invoke as often. `throttle` works by allowing the function to go through once and not again until a timeframe has elapsed (handy for a repeated event that you want some continuous feedback for). `debounce` works by not invoking until the function has stopped being called for a timeframe (handy for a repeated event that you only want feedback after the events have stopped barraging).
  
  - `throttle(delayInMilliseconds[, omitLast], callback)`: throttle `callback` to execute at most once every `delayInMilliseconds`.
  - `debounce(delayInMilliseconds[, includeFirst], callback)`: throttle `callback` to execute once it has stopped being invoked by at least `delayInMilliseconds`.

### Example
    window.onresize = concur.throttle(200, function () {
        // do stuff here
    });
    
    someElement.onkeyup = concur.debounce(200, function () {
        // do stuff here
    });

## nextTick and sleep
  For nextTick, execute a callback at the next possible "tick". For browsers, this means setting a timer with a 0-ms delay. For node.js, this will utilize `process.nextTick`. For sleep, execute after a certain delay in milliseconds.
  
  - `nextTick(callback, thisArg)`: execute ASAP, but not synchronously
  - `sleep(delayInMilliseconds, callback, thisArg)`: execute after `delayInMilliseconds`

### Arguments
  * `delayInMilliseconds` - The amount of time to wait before executing
  * `callback()` - a function to be executed.
  * `thisArg` - a value that will be passed in as the `this` argument to all callbacks.

### Example
    concur.nextTick(function () {
        // executed on the next tick
    });
    
    concur.sleep(1000, function () {
        // executed in 1 second
    });

## raise (or throw)
  Throw an error asynchronously that will bubble to the very top of the stack. This is specifically handy for if a function must return a value, such as browser DOM events returning false.
  
  `throw` is provided as well as `raise` (they are aliases), but some JavaScript interpreters can't interpret `concur.throw` properly, and `concur["throw"]` would be necessary. If you use a compile-to-javascript language like CoffeeScript or UglifyJS, you should not have any problems.
  
  If used in a server-side application without uncaught exception handling, this will cause your process to die.
  
  - `throw or raise(err)`: Throw an error on the next tick.

### Example
    someElement.onclick = function () {
        try {
            somethingWhichMightBreak();
        } catch (e) {
            concur.raise(e);
        }
        return false;
    };

## noConflict
  Return the `concur` library and replace the global `concur` reference with the previous value.

### Example
    // load concur
    var myConcur = concur.noConflict();
    // now concur is the old version

## STOP
  `STOP` is a special token that when passed in as the `err` argument to a callback, it acts to break the loop without actually treating the loop as broken by an error. It is not recommended to use with `filter` or `map` loops or other non-simple functions.

### Example
    concur.forEach(bigArray, function (value, callback) {
        if (value == someSpecialValue) {
            callback(concur.STOP);
        } else {
            callback();
        }
    });

## License

MIT licensed. See [LICENSE](https://github.com/ckknight/concur/blob/master/LICENSE) for more details.
