'use strict';

const util = require('./util');
const makeRequest = require('./makeRequest');
// const makeAutoPaginationMethods = require('./autoPagination').makeAutoPaginationMethods;

/**
 * Create an API method from the declared spec.
 *
 * @param [spec.method='GET'] Request Method (POST, GET, DELETE, PUT)
 * @param [spec.path=''] Path to be appended to the API BASE_PATH, joined with
 *  the instance's path (e.g. 'campsites' or 'campgrounds')
 * @param [spec.queryParams=[]] Array of allowed query aruments 
 * @param [spec.urlParams=[]] Array of required arguments in the order that they
 *  must be passed by the consumer of the API. Subsequent optional arguments are
 *  optionally passed through a hash (Object) as the penultimate argument
 *  (preceding the also-optional callback argument
 * @param [spec.encode] Function for mutating input parameters to a method.
 *  Usefully for applying transforms to data on a per-method basis.
 * @param [spec.host] Hostname for the request.
 */
function campzimmerResourceAction(spec) {
  return function(...args) {
    const callback = typeof args[args.length - 1] == 'function' && args.pop();

    spec.urlParams = util.extractUrlParams(
      this.createResourcePathWithSymbols(spec.path || '')
    );

    const requestPromise = util.callbackifyPromiseWithTimeout(
      makeRequest(this, args, spec, {}),
      callback
    );

    // if (spec.methodType === 'list') {
    //   const autoPaginationMethods = makeAutoPaginationMethods(
    //     this,
    //     args,
    //     spec,
    //     requestPromise
    //   );
    //   Object.assign(requestPromise, autoPaginationMethods);
    // }

    return requestPromise;
  };
}

module.exports = campzimmerResourceAction;
