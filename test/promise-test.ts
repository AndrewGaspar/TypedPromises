/// <reference path="definitions/mocha.d.ts" />
/// <reference path="definitions/node.d.ts" />
/// <reference path="definitions/q.d.ts" />

import TypedPromises = require("../TypedPromises");
import q = require("q");

describe("Promises/A+ tests", function () {
	it("should create a promise that completes", done => {
		var d = TypedPromises(3);
		d.then(num => done(num == 3 ? undefined : num + ""));
	});

	describe("promise interop", () => {
		it("should work in q", done => {
			q(3).then<number>(x => TypedPromises<number>(x)).then(x => done(x === 3 ? undefined : x));
		});

		it("should be able to consume a q promise", done =>
			TypedPromises(3).then<number>(q).then(x => done(x === 3 ? undefined : x)));
	});

	require("promises-aplus-tests").mocha({
		pending: function () {
			var d = TypedPromises.createDeferral();

            return {
				promise: d.promise,
				fulfill: d.resolve,
				reject: d.reject
			}
        }
	});
});