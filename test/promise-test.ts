/// <reference path="definitions/mocha.d.ts" />

import AGPromises = require("../TypedPromises");

describe("Promises/A+ tests", function () {
	it("should create a promise that completes", done => {
		var d = AGPromises(3);
		d.then(num => done(num == 3 ? undefined : num + ""));
	});

	require("promises-aplus-tests").mocha({
		pending: function () {
			var d = AGPromises.createDeferral();

            return {
				promise: d.getPromise(),
				fulfill: value => d.resolve(value),
				reject: reason => d.reject(reason)
			}
        }
	});
});