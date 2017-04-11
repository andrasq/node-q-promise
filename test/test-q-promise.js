'use strict';

var qassert = require('qassert');
var P = require('../');

describe ('q-promise', function(){

    var p;

    beforeEach (function(done) {
        p = new P();
        done();
    })

    afterEach (function(done) {
        P.onResolve(false);
        done();
    })

    describe ('constructor', function(){
        it ('executor should be optional', function(done) {
            var p = new P();
            qassert.ok(p instanceof P);
            done();
        })

        it ('initial state should be pending', function(done) {
            qassert.ok(!p.state);
            done();
        })

        it ('should immediately call executor', function(done) {
            new P(function(resolve, reject) {
                qassert.contains(new Error().stack, __filename);
                done();
            })
        })

        it ('should remain unresolved if executor returns a promise', function(done) {
            var p = new P(function(resolve) { resolve(new P()) });
            qassert(!p.state);
            done();
        })

        it ('should reject if executor throws', function(done) {
            var p = new P(function(resolve) { throw new Error("executor error") }); 
            qassert.equal(p.state, 'n', "wanted rejected");
            done();
        })

        it ('should call __resolve with return fulfillment value', function(done) {
            var called;
            P.onResolve(function(v, p, s) { called = [v, p, s] })
            var p = new P(function(resolve, reject) { resolve(123) });
            qassert.deepEqual(called, [123, p, 'y']);
            done();
        })

        it ('should call __resolve with rejection cause', function(done) {
            var called;
            P.onResolve(function(v, p, s) { called = [v, p, s] })
            var p = new P(function(resolve, reject) { reject(123) });
            qassert.deepEqual(called, [123, p, 'n']);
            done();
        })
    })

    describe ('resolve', function(){
        it ('should return a fulfilled promise', function(done) {
            var p = P.resolve(123);
            qassert(p instanceof P);
            qassert.equal(p.state, 'y');
            qassert.equal(p.value, 123);
            done();
        })

        it ('should call __resolve on a value', function(done) {
            var called;
            P.onResolve(function(v, p, s){ called = [v, p, s] });
            var p = P.resolve(1);
            qassert.deepEqual(called, [1, p, 'y']);
            done();
        })

        it ('should call __resolve on a function result', function(done) {
            var called;
            P.onResolve(function(v, p, s){ called = [v, p, s] });
            var p = P.resolve(function(){ return 123 });
            qassert.deepEqual(called, [123, p, 'y']);
            done();
        })
    })

    describe ('reject', function(){
        it ('should return a rejected promise', function(done) {
            var p = P.reject(123);
            qassert(p instanceof P);
            qassert.equal(p.state, 'n');
            qassert.equal(p.value, 123);
            done();
        })

        it ('should call __resolve on a value', function(done) {
            var called;
            P.onResolve(function(v, p, s){ called = [v, p, s] });
            var p = P.reject(123);
            qassert.deepEqual(called, [123, p, 'n']);
            done();
        })
        it ('should call __resolve on a function result', function(done) {
            var called;
            P.onResolve(function(v, p, s){ called = [v, p, s] });
            var p = P.reject(function(){ return 123 });
            qassert.deepEqual(called, [123, p, 'n']);
            done();
        })
    })

    describe ('then', function(){
        it ('should return a new promise', function(done) {
            var p2 = p.then();
            qassert.equal(p2.constructor, p.constructor);
            done();
        })

        it ('should settle with resolved value', function(done) {
            p._resolve(123);
            var p2 = p.then();
            qassert.equal(p2.value, 123);
            qassert.equal(p2.state, 'y');
            done();
        })

        it ('should settle with rejected cause', function(done) {
            p._reject(123);
            var p2 = p.then();
            qassert.equal(p2.value, 123);
            qassert.equal(p2.state, 'n');
            done();
        })

        it ('should report value to then-resolve', function(done) {
            p._resolve(123);
            var p2 = p.then(resolve, reject);
            function resolve(v) {
                setImmediate(function(){
                    qassert.equal(v, 123);
                    qassert.equal(p2.state, 'y');
                    done();
                })
            }
            function reject(e) {
                qassert.fail();
            }
        })

        it ('should report cause to then-reject', function(done) {
            p._reject(123);
            var p2 = p.then(resolve, reject);
            function resolve(v) {
                qassert.fail();
            }
            function reject(e) {
                setImmediate(function(){
                    qassert.equal(p2.state, 'n');
                    qassert.equal(p2.value, 123);
                    done();
                })
            }
        })

        it ('should reject if resolve throws', function(done) {
            var err = new Error("resolve error");
            var p2 = p.then(function(v) { throw err });
            p._resolve(1);
            setImmediate(function(){
                qassert.equal(p2.state, 'n');
                qassert.equal(p2.value, err);
                done();
            })
        })

        it ('should reject if reject throws', function(done) {
            var err = new Error("reject error");
            var p2 = p.then(null, function(e) { throw err });
            p._reject(1);
            setImmediate(function(){
                qassert.equal(p2.state, 'n');
                qassert.contains(p2.value, err);
                done();
            })
        })

        it ('should call resolve without this from system stack', function(done) {
            (function localStackMarker() {
                var called;
                var p2 = p.then(function(v) {
                    qassert.equal(v, 1234);
                    qassert.equal(this, null);
                    qassert.ok(new Error().stack.indexOf('localStackMarker') < 0);
                    done();
                })
                p._resolve(1234);
            })();
        })

        it ('should call reject without this from system stack', function(done) {
            (function localStackMarker() {
                var called;
                var p2 = p.then(null, function(v) {
                    qassert.equal(v, 1234);
                    qassert.equal(this, null);
                    qassert.ok(new Error().stack.indexOf('localStackMarker') < 0);
                    done();
                })
                p._reject(1234);
            })();
        })

        it ('should notify with fulfilled value', function(done) {
            var called;
            p.then(function(v) { called = v });
            p._resolve(123);
            setImmediate(function() {
                qassert.equal(called, 123);
                done();
            })
        })

        it ('should notify with rejected cause', function(done) {
            var called;
            p.then(null, function(e) { called = e });
            p._reject(123);
            setImmediate(function() {
                qassert.equal(called, 123);
                done();
            })
        })

        it ('should resolve with value if no then resolve function', function(done) {
            // test with one listener to check single-listener handling; two below
            var p2 = p.then(null, function(e){});
            p._resolve(123);
            setImmediate(function() {
                qassert.equal(p2.state, 'y');
                qassert.equal(p2.value, 123);
                done();
            })
        })

        it ('should reject with value if no then reject function', function(done) {
            // test with two listeners to check multi-listener handling; one above
            var p2 = p.then(function(e){}, 2);
            var p3 = p.then(function(e){}, 2);
            p._reject(123);
            setImmediate(function() {
                qassert.equal(p2.state, 'n');
                qassert.equal(p2.value, 123);
                qassert.equal(p3.state, 'n');
                qassert.equal(p3.value, 123);
                done();
            })
        })

        it ('should notify multiple resolves, in order', function(done) {
            var calls = [];
            var p2 = p.then(function(v){ v = 1; calls.push(v); return v });
            var p3 = p.then(function(v){ v = 2; calls.push(v); return v });
            var p4 = p.then(function(v){ v = 3; calls.push(v); return v });
            p._resolve(123);
            setImmediate(function(){
                qassert.deepEqual(calls, [1, 2, 3]);
                qassert.equal(p2.state, 'y');
                qassert.equal(p2.value, 1);
                qassert.equal(p3.state, 'y');
                qassert.equal(p3.value, 2);
                qassert.equal(p4.state, 'y');
                qassert.equal(p4.value, 3);
                done();
            });
        })

        it ('should notify multiple rejects, in order', function(done) {
            var calls = [];
            var p2 = p.then(null, function(v){ v = 1; calls.push(v); return v });
            var p3 = p.then(null, function(v){ v = 2; calls.push(v); return v });
            var p4 = p.then(null, function(v){ v = 3; calls.push(v); return v });
            var p5 = p.then();
            p._reject(123);
            setImmediate(function(){
                qassert.deepEqual(calls, [1, 2, 3]);
                // if then-reject() returns a value, settle the promise with it
                qassert.equal(p2.state, 'y');
                qassert.equal(p2.value, 1);
                qassert.equal(p3.state, 'y');
                qassert.equal(p3.value, 2);
                qassert.equal(p4.state, 'y');
                qassert.equal(p4.value, 3);
                // if no then-reject function, reject the promise with p1.value
                qassert.equal(p5.state, 'n');
                qassert.equal(p5.value, 123);
                done();
            });
        })
    })

    describe ('catch', function(){
        it ('should call then', function(done) {
            var called;
            var handler = function(){};
            p.then = function(resolve, reject) { called = [resolve, reject] };
            p.catch(handler);
            qassert.deepEqual(called, [undefined, handler]);
            done();
        })
    })

    describe ('__resolve', function(){
        var dataset = [
            0,
            false,
            null,
            undefined,
            123,
            "foo",
            new Date("2001-01-01T00:00:00.000Z"),
            /foobar/i,
            {a:1},
            [1,3,5],
            {test:1},
        ];

        function testDataset( dataset, verifyCb, done ) {
            var i = 0, v;
            forEachParallel(
                dataset,
                function(v, i, next) {
                    var p = P.resolve(v);
                    setImmediate(function() {
                        verifyCb(p, i);
                        next();
                    });
                },
                done
            );
        }

        it ('should not resolve a fulfilled promise', function(done) {
            p._resolve(1);
            p._resolve(2);
            qassert.equal(p.value, 1);
            done();
        })

        it ('should not resolve a rejected promise', function(done) {
            p._reject(1);
            p._reject(2);
            qassert.equal(p.value, 1);
            done();
        })

        it ('should reject if a thenable function throws', function(done) {
            var err = new Error('die');
            var err2 = new Error('die2');
            var p2 = p.then(function(){ throw err });
            // chain p3 to p2, when p2 rejects p3 will also
            var p3 = p2.then(null, function(){ throw err2 });
            p._resolve(1);
            setImmediate(function() {
                qassert.equal(p2.state, 'n');
                qassert.equal(p2.value, err);
                qassert.equal(p3.state, 'n');
                qassert.equal(p3.value, err2);
                done();
            })
        })

        it ('should resolve values', function(done) {
            testDataset(dataset, function(p, i) {
                qassert.equal(p.state, 'y');
                qassert.equal(p.value, dataset[i]);
            }, done);
        })

        it ('should resolve settled promises', function(done) {
            var ds = [];
            for (var i=0; i<dataset.length; i++) ds[i] = P.resolve(dataset[i]);
            testDataset(ds, function(p, i) {
                qassert.equal(p.state, 'y');
                qassert.equal(p.value, ds[i].value);
            }, done);
        })

        it ('should resolve pending promises that are fulfilled by resolve', function(done) {
            var ds = [];
            for (var i=0; i<dataset.length; i++) ds[i] = (function(v){
                return new P(function(resolve, reject) {
                    setTimeout(resolve, 5, v);
                })
            })(dataset[i]);
            testDataset(ds, function(p, i) {
                qassert.ok(!ds[i].state);
                qassert.ok(!p.state);
            },
            function(err) {
                if (err) return done(err);
                setTimeout(function() {
                    testDataset(ds, function(p, i) {
                        qassert.equal(ds[i].state, 'y');
                        qassert.equal(ds[i].value, dataset[i]);
                        qassert.equal(p.state, 'y');
                        qassert.equal(p.value, ds[i].value);
                    }, done);
                }, 10);
            });
        })

        it ('should resolve pending promises that are eventually rejected', function(done) {
            var ds = [];
            for (var i=0; i<dataset.length; i++) ds[i] = (function(v){
                return new P(function(resolve, reject) {
                    setTimeout(reject, 5, P.resolve(v));
                })
            })(dataset[i]);
            testDataset(ds, function(p, i) {
                qassert.ok(!ds[i].state);
                qassert.ok(!p.state);
            },
            function(err) {
                if (err) return done(err);
                setTimeout(function() {
                    testDataset(ds, function(p, i) {
                        qassert.equal(ds[i].state, 'y');
                        qassert.equal(ds[i].value, dataset[i]);
                        qassert.equal(p.state, 'y');
                        qassert.equal(p.value, ds[i].value);
                    }, done);
                }, 10);
            });
        })

        it ('should resolve a thenable', function(done) {
            done();
        })

        it ('should resolve a value returned by a then resolve', function(done) {
            done();
        })

        it ('should resolve a thenable returned by a then resolve', function(done) {
            done();
        })
    })

    describe ('helpers', function(){
        it ('_resolve should call __resolve', function(done) {
            var called;
            P.onResolve(function(v, p, state) { called = [v, p, state] });
            p._resolve(123);
            qassert.deepEqual(called, [123, p, 'y']);
            done();
        })

        it ('_reject should call __resolve', function(done) {
            var called;
            P.onResolve(function(v, p, state) { called = [v, p, state] });
            p._reject(123);
            qassert.deepEqual(called, [123, p, 'n']);
            done();
        })
    })
})


function testResolvesDataset( tester, cb ) {
    var dataset = [
    ];
    for (var i=0; i<dataset.length; i++) {
        var p = tester(dataset[i]);
        
    }
    if (cb) cb();
}

function repeatWhile( test, loop, cb ) {
    if (!test()) return cb();

    loop(function(err) {
        if (err) return cb(err);
        setImmediate(function(){
            repeatWhile(test, loop, cb)
        });
    });
}

function forEachParallel( list, visitor, cb ) {
    var ndone = 0;
    var finished = false;

    for (var i=0; i<list.length; i++) doVisit(list[i], i);

    function doVisit(v, i) {
        visitor(v, i, function(err) {
            ndone += 1;
            if ((err || ndone === list.length) && !finished) {
                finished = true;
                cb(err);
            }
        });
    }
}