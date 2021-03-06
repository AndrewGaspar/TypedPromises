/*******************************
Author: Andrew Gaspar
Date: July 7, 2013

You may use this software for free without restrictions as long as this header is retained.

Please contribute any fixes to https://github.com/AndrewGaspar/TypedPromises
*******************************/

/*
	Ensures the promise matches an APlusPromise implementation.
	@param promise A promise that is thenable.
*/
function TypedPromises<T>(promise: TypedPromises.APlusPromise<T>): TypedPromises.APlusPromise<T>;

/*
	Wraps a value as a promise.
	@param value The value to be promised.
*/
function TypedPromises<T>(value: T): TypedPromises.APlusPromise<T>;
function TypedPromises<T>(valueOrPromise): TypedPromises.APlusPromise<T> {
	return TypedPromises.promisify(valueOrPromise);
}

/**
  *	A module with functions for creating deferred objects that can be resolve and with other useful related functions.
  */
module TypedPromises {
	/**
	  *	Checks if a value is a function.
	  *	http://stackoverflow.com/questions/5999998/how-can-i-check-if-a-javascript-variable-is-function-type
	  *	@param f A value that may or may not be a function.
	  */
	export function isFunction(f) {
		var getType = {};
		return !!f && getType.toString.call(f) === '[object Function]';
	}

	/**
	  *	Checks if a value is a promise - i.e. has a then function
	  *	@param obj A value that may or may not be a promise.
	  */
	export function isPromise(obj) {
		return obj && obj.then && isFunction(obj.then);
	}

	/**
	  *	Checks if a value is a promise from this library. Used to enforce conformance to APlusPromise standard.
	  * @param obj A value that may or may not be an AGPromise.
	  */
	export function isAGPromise(obj) {
		return obj && obj._isAGPromise;
	}

	/**
	  *	This interface represents a generic promise conforming to the APlusPromise interface.
	  */
	export interface APlusPromise<T> {
		then<U>(onFulfill: (value: T) => APlusPromise<U>, onReject?: (reason) => IPromise<U>): APlusPromise<U>;
		then<U>(onFulfill: (value: T) => APlusPromise<U>, onReject?: (reason) => U): APlusPromise<U>;
		then<U>(onFulfill: (value: T) => U, onReject?: (reason) => IPromise<U>): APlusPromise<U>;
		then<U>(onFulfill: (value: T) => U, onReject?: (reason) => U): APlusPromise<U>;
	}

	/* To support environments with process.nextTick and/or setImmediate */
	declare function setImmediate(f: Function): void;
	declare var process: { nextTick(f: Function): void };

	/**
	  *	This function defers a function to run in a later turn of the event loop.
	  *
	  *	process.nextTick is preferred, then setImmediate, then setTimeout
	  *
	  * @param func The function to be deferred.
	  */
	export var deferFunction: (func: Function) => void = (function () {
		if (setImmediate) return setImmediate;

		return function (f) { setTimeout(f, 0); };
	})();

	/**
	  *	This class represents a queue of functions that need to be iterated through.
	  */
	class FunctionQueue {
		private _funcs: Function[] = [];
		private _started = false;

		/**
		  *	Runs all functions currently in the FunctionQueue in the next turn of the event loop.
		  */
		private _iterator() {
			var funcs = this._funcs;
			this._funcs = [];
			deferFunction(() => {
				funcs.forEach(f => f());
			});
		}

		/**
		  *	Enqueues a function in the FunctionQueue. If the iteration has been started, runs the iterator.
		  *	@param func The function to defer.
		  */
		public enqueue(func: Function) {
			if (isFunction(func)) {
				this._funcs.push(func);
				if (this._started && this._funcs.length === 1) {
					this._iterator();
				}
			}
		}

		/**
		  *	Start iteration through the functions.
		  */
		public start() {
			if (!this._started) {
				this._started = true;
				if (this._funcs.length > 0) this._iterator();
			}
		}
	}

	/**
	  * Creates a FunctionQueue.
	  */
	function createFunctionQueue() {
		return new FunctionQueue();
	}

	/**
	  * An implementation specific promise. Used internally.
	  */
	interface TypedPromise<T> extends APlusPromise<T> {
		_isAGPromise: bool;
		_value: T;
		_reason;
	}

	export interface IDeferral<T> {
		/**
			Resolves a deferral with a promise conforming to the APlusPromise interface.
			The deferral's promise should take the value of the promise supplied.

			@param promise A promise to resolve the deferral with.
		*/
		resolve(promise: APlusPromise<T>): void;

		/**
			Resolves a deferral with a value.

			@param value The value to resolve the Deferral with.
		*/
		resolve(value: T): void;

		/**
			Rejects a promise with the supplied reason.
			@param reason The reason the deferral failed.
		*/
		reject(reason): void;

		/**
			The promise that the deferral is crafting.
		*/
		promise: APlusPromise<T>;
	}

	/**
	  * This class represents a deferral. It can be used to create a promise. Offers functions for fulfilling or rejecting a function.
	  */
	class _deferral<T> {
		private _isPending: bool = true;
		private _isResolved: bool = false;
		private _isRejected: bool = false;

		private _fulfillQueue = createFunctionQueue();
		private _rejectQueue = createFunctionQueue();

		public promise;

		public resolve: (value: T) => void;
		public reject: (reason) => void;

		constructor() {
			var def = this;

			this.resolve = (value: any) => (isPromise(value)) ? value.then(v => def._onResolve(v), r => def._onReject(r)) : def._onResolve(value);

			this.reject = reason => def._onReject(reason);

			this.promise = {
				_isAGPromise: true,
				then: function (onFulfilled, onRejected) {
					var def2 = createDeferral();

					def._queueFulfill(function () {
						if (isFunction(onFulfilled)) {
							try {
								var result = onFulfilled(def.promise._value);
								def2.resolve(result);
							} catch (e) {
								def2.reject(e);
							}
						} else {
							def2.resolve(def.promise._value);
						}
					});

					def._queueReject(function () {
						if (isFunction(onRejected)) {
							try {
								var error = onRejected(def.promise._reason);
								def2.resolve(error);
							} catch (e) {
								def2.reject(e);
							}
						} else {
							def2.reject(def.promise._reason);
						}
					});

					return def2.promise;
				}
			}
		}

		private _onResolve(val) {
			if (this._isPending) {
				this._isResolved = true;
				this._isPending = false;

				this.promise._value = val;

				this._rejectQueue = null;
				this._fulfillQueue.start();
			}
		}

		private _onReject(rea) {
			if (this._isPending) {
				this._isRejected = true;
				this._isPending = false;

				this.promise._reason = rea;

				this._fulfillQueue = null;
				this._rejectQueue.start();
			}
		}

		private _queueFulfill(fulfillCallback) {
			if (this._fulfillQueue) this._fulfillQueue.enqueue(fulfillCallback);
		}

		private _queueReject(rejectCallback) {
			if (this._rejectQueue) this._rejectQueue.enqueue(rejectCallback);
		}
	}

	/**
	  *	Creates a Deferral object.
	  */
	export function createDeferral<T>(): IDeferral<T> {
		return new _deferral<T>();
	}

	/**
		Returns a TypedPromises promise from any standard APlusPromise conforming promise.

		@param promise The promise to TypedPromisify.
	*/
	export function promisify<T>(promise: APlusPromise<T>): APlusPromise<T>;

	/**
		Returns a TypedPromises promise fulfilled with the value provided.

		@param value The value to be promised.
	*/
	export function promisify<T>(value: T): APlusPromise<T>;
	export function promisify<T>(valueOrPromise): APlusPromise<T> {
		if (isAGPromise(valueOrPromise)) return valueOrPromise;

		var def = createDeferral<T>();
		def.resolve(valueOrPromise);
		return def.promise;
	}

	/**
		Returns a TypedPromises promise rejected with the reason provided.

		@param reason The reason for the rejected promise
	*/
	export function rejectify(reason): APlusPromise<any> {
		var def = createDeferral();
		def.reject(reason);
		return def.promise;
	}
}

export = TypedPromises;