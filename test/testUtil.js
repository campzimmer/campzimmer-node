'use strict';

// NOTE: testUtils should be require'd before anything else in each spec file!

require('mocha');
// Ensure we are using the 'as promised' libs before any tests are run:
require('chai').use(require('chai-as-promised'));

const utils = (module.exports = {
  getUserCampzimmerKey: () => {
    const key =
      process.env.CAMPZIMMER_TEST_API_KEY || 'NWQwMWIxNTZmLzMxYTlhZWE1MDRmOTE4';

    return key;
  },

  getSpyableCampzimmer: () => {
    // Provide a testable stripe instance
    // That is, with mock-requests built in and hookable

    const campzimmer = require('../src/index');
    const campzimmerInstance = stripe('fakeAuthToken');

    campzimmerInstance.REQUESTS = [];

    for (const i in campzimmerInstance) {
      makeInstanceSpyable(campzimmerInstance, campzimmerInstance[i]);
    }

    function makeInstanceSpyable(stripeInstance, thisInstance) {
      if (thisInstance instanceof campzimmer.CampzimmerResource) {
        patchRequest(stripeInstance, thisInstance);
      } else {
        console.log(
          'Something went wrong. The resource should be an instance of CampzimmerResource'
        );
      }
    }

    function patchRequest(czInstance, instance) {
      instance._request = function(method, host, url, data, auth, options, cb) {
        const req = (czInstance.LAST_REQUEST = {
          method,
          url,
          data,
          headers: options.headers || {},
        });
        if (auth) {
          req.auth = auth;
        }
        if (host) {
          req.host = host;
        }
        czInstance.REQUESTS.push(req);
        cb.call(this, null, {});
      };
    }

    return czInstance;
  },

  /**
   * A utility where cleanup functions can be registered to be called post-spec.
   * CleanupUtility will automatically register on the mocha afterEach hook,
   * ensuring its called after each descendent-describe block.
   */
  CleanupUtility: (() => {
    CleanupUtility.DEFAULT_TIMEOUT = 20000;

    function CleanupUtility(timeout) {
      const self = this;
      this._cleanupFns = [];
      this._cz = require('../src/index')(
        utils.getUserCampzimmerKey(),
        'latest'
      );
      afterEach(function(done) {
        this.timeout(timeout || CleanupUtility.DEFAULT_TIMEOUT);
        return self.doCleanup(done);
      });
    }

    CleanupUtility.prototype = {
      doCleanup(done) {
        const cleanups = this._cleanupFns;
        const total = cleanups.length;
        let completed = 0;
        let fn;
        while ((fn = cleanups.shift())) {
          const promise = fn.call(this);
          if (!promise || !promise.then) {
            throw new Error(
              'CleanupUtility expects cleanup functions to return promises!'
            );
          }
          promise.then(
            () => {
              // cleanup successful
              completed += 1;
              if (completed === total) {
                done();
              }
            },
            (err) => {
              // not successful
              throw err;
            }
          );
        }
        if (total === 0) {
          done();
        }
      },
    };

    return CleanupUtility;
  })(),

  /**
   * Get a random string for test Object creation
   */
  getRandomString: () => {
    return Math.random()
      .toString(36)
      .slice(2);
  },

  envSupportsForAwait: () => {
    return typeof Symbol !== 'undefined' && Symbol.asyncIterator;
  },

  envSupportsAwait: () => {
    try {
      eval('(async function() {})'); // eslint-disable-line no-eval
      return true;
    } catch (err) {
      return false;
    }
  },
});
