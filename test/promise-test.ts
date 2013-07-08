/// <reference path="definitions/mocha.d.ts" />

import TypedPromises = require("../TypedPromises");

describe("Promises/A+ tests", function () {
	it("should create a promise that completes", done => {
		var d = TypedPromises(3);
		d.then(num => done(num == 3 ? undefined : num + ""));
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