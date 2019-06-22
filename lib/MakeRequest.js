'use strict';

const util = require('./util');
const native_util = require('util');
const hasOwn = {}.hasOwnProperty;

function getRequestOpts(self, requestArgs, spec, overrideData) {
  // Extract spec values with defaults.
  const commandPath = util.makeURLInterpolator(spec.path || '');
  const requestMethod = (spec.method || 'GET').toUpperCase();
  const urlParams = spec.urlParams || [];
  const validQueryParams = spec.queryParams || [];
  const encode = spec.encode || ((data) => data);
  const host = spec.host;
  const path = self.createResourcePathWithSymbols(spec.path);
  let queryData = '';

  debugger;
  
  // Don't mutate args externally.
  const args = [].slice.call(requestArgs);
  
  const queryFreeArgs = args.filter((arg) => !util.isObject(arg) && !hasOwn.call(arg, 'query'));

  // Generate and validate url params.
  const urlData = urlParams.reduce((urlData, param) => {
    const arg = queryFreeArgs.shift();
    if (typeof arg !== 'string') {
      throw new Error(
        `Campzimmer: Argument "${param}" must be a string, but got: ${arg} (on API request to \`${requestMethod} ${path}\`)`
      );
    }

    urlData[param] = arg;
    return urlData;
  }, {});

  // Validates the query parameters pass in
  const queryFound = args.filter((arg) => util.isObject(arg) && hasOwn.call(arg, 'query'));
  if(queryFound.length !== 0){
    if(!util.isValidatedQueryObject(queryFound[0].query, validQueryParams)){
      throw new Error(
        `Campzimmer: Invalid query parameters. See https://docs.campzimmer.com/ for valid query parameters options for each API method.`
      );
    } else {
      queryData = `?${util.stringifyRequestData(queryFound[0].query)}`;
    }
  }

  
  // Pull request data and options (headers, auth) from args.
  const dataFromArgs = util.getDataFromArgs(queryFreeArgs);
  const data = encode(Object.assign({}, dataFromArgs, overrideData));
  const options = util.getOptionsFromArgs(args);

  // Validate that there are no more args.
  if (queryFreeArgs.length) {
    throw new Error(
      `Campzimmer: Unknown arguments (${args}). Did you mean to pass a query parameters object or options object? See https://github.com/campzimmer/campzimmer-node/wiki/Passing-Queries-Options. (on API request to ${requestMethod} \`${path}\`)`
    );
  }

  const requestPath = self.createFullPath(commandPath, urlData, queryData);
  const headers = Object.assign(options.headers, spec.headers);

  if (spec.validator) {
    spec.validator(data, {headers});
  }

  return {
    requestMethod,
    requestPath,
    data,
    auth: options.auth,
    headers,
    host,
  };
}

function makeRequest(self, requestArgs, spec, overrideData) {
  return new Promise((resolve, reject) => {
    try {
      var opts = getRequestOpts(self, requestArgs, spec, overrideData);
    } catch (err) {
      reject(err);
      return;
    }

    function requestCallback(err, response) {
      if (err) {
        reject(err);
      } else {
        resolve(
          spec.transformResponseData
            ? spec.transformResponseData(response)
            : response
        );
      }
    }

    self._request(
      opts.requestMethod,
      opts.host,
      opts.requestPath,
      opts.data,
      opts.auth,
      {headers: opts.headers},
      requestCallback
    );
  });
}

module.exports = makeRequest;
