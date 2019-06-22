'use strict';

const http = require('http');
const https = require('https');
const path = require('path');
const util = require('./util');
const Error = require('./Error');

const httpAgent = new http.Agent({keepAlive: true});
const httpsAgent = new https.Agent({keepAlive: true});

/**
 * Encapsulates request logic for a Campzimmer Resource
 */
function CampzimmerResource(campzimmer) {
  this._cz = campzimmer;

  this.basePath = util.makeURLInterpolator(campzimmer.getApiField('basePath'))
  this.resourcePath = this.path;
  this.path = util.makeURLInterpolator(this.path);
  this.initialize(...arguments);
}

CampzimmerResource.extend = util.protoExtend;

CampzimmerResource.prototype.path = '';

CampzimmerResource.prototype.basePath = null;

CampzimmerResource.prototype.createFullPath = function(commandPath, urlData, queryData) {
  return path
    .join(
      this.basePath(urlData),
      this.path(urlData),
      typeof commandPath == 'function' ? commandPath(urlData) : commandPath
    )
    .replace(/\\/g, '/') + queryData; // ugly workaround for Windows
}

CampzimmerResource.prototype.initialize = function() {};

CampzimmerResource.prototype._defaultHeaders = function(
  auth,
  contentLength,
  apiVersion
) {
  let userAgentString = `Campzimmer/v1 NodeBindings/${this._cz.getConstant(
    'PACKAGE_VERSION'
  )}`;

  if (this._cz._appInfo) {
    userAgentString += ` ${this._cz.getAppInfoAsString()}`;
  }

  const headers = {
    // Use specified auth token or use default from this stripe instance:
    Authorization: auth ? `Bearer ${auth}` : this._cz.getApiField('auth'),
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': contentLength,
    'User-Agent': userAgentString,
  };

  if (apiVersion) {
    headers['Campzimmer-Version'] = apiVersion;
  }

  return headers;
};

// Creates a relative resource path with symbols left in (unlike
// createFullPath which takes some data to replace them with). For example it
// might produce: /invoices/{id}
CampzimmerResource.prototype.createResourcePathWithSymbols = function(pathWithSymbols) {
  return `/${path
    .join(this.resourcePath, pathWithSymbols || '')
    .replace(/\\/g, '/')}`; // ugly workaround for Windows
}

CampzimmerResource.prototype._request = function(
  method,
  host,
  path,
  data,
  auth,
  options,
  callback
) {
  let requestData;

  const makeRequest = (apiVersion, headers, numRetries) => {
    const timeout = this._cz.getApiField('timeout');
    const isInsecureConnection = this._cz.getApiField('protocol') == 'http';
    let agent = this._cz.getApiField('agent');
    if (agent == null) {
      agent = isInsecureConnection ? httpAgent : httpsAgent;
    }
    debugger;
    const req = (isInsecureConnection ? http : https).request({
      host: host || this._cz.getApiField('host'),
      port: this._cz.getApiField('port'),
      path,
      method,
      agent,
      headers,
    });


    // Building event for request event occurred
    const requestEvent = util.removeEmptyProperties({
      api_version: apiVersion,
      account: headers['Campzimmer-Account'],
      method,
      path,
    });

    const requestRetries = numRetries || 0;

    req._requestEvent = requestEvent;

    req._requestStart = Date.now();

    // We are not emitting events right at this moment
    // This._cz._emitter.emit('request', requestEvent);

    req.setTimeout(timeout, this._timeoutHandler(timeout, req, callback));

    req.on('response', (res) => {
      debugger;
      return this._responseHandler(req, callback)(res);
    });

    req.on('error', (error) => {
      debugger;
      return this._errorHandler(req, requestRetries, callback)(error);
    });

    req.on('socket', (socket) => {
      if (socket.connecting) {
        socket.on(isInsecureConnection ? 'connect' : 'secureConnect', () => {
          // Send payload; we're safe:
          req.write(requestData);
          req.end();
        });
      } else {
        // we're already connected
        req.write(requestData);
        req.end();
      }
    });
  };

  const makeRequestWithData = (error, data) => {
    if (error) {
      return callback(error);
    }

    const apiVersion = this._cz.getApiField('version');
    requestData = data;
    const headers = this._defaultHeaders(auth, requestData.length, apiVersion);

    this._cz.getClientUserAgent((cua) => {
      headers['X-Campzimmer-Client-User-Agent'] = cua;

      if (options.headers) {
        Object.assign(headers, options.headers);
      }

      makeRequest(apiVersion, headers);
    });
  };

  if (this.requestDataProcessor) {
    this.requestDataProcessor(
      method,
      data,
      options.headers,
      makeRequestWithData
    );
  } else {
    makeRequestWithData(null, util.stringifyRequestData(data || {}));
  }
};

CampzimmerResource.prototype._timeoutHandler = function(timeout, req, callback) {
  return () => {
    const timeoutErr = new Error('ETIMEDOUT');
    timeoutErr.code = 'ETIMEDOUT';

    req._isAborted = true;
    req.abort();

    callback.call(
      this,
      new Error.StripeConnectionError({
        message: `Request aborted due to timeout being reached (${timeout}ms)`,
        detail: timeoutErr,
      }),
      null
    );
  };
};

CampzimmerResource.prototype._responseHandler = function(req, callback) {
  return (res) => {
    let response = '';

    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      response += chunk;
    });
    res.on('end', () => {
      debugger;
      const headers = res.headers || {};
      // NOTE: Stripe responds with lowercase header names/keys.

      // For convenience, make Request-Id easily accessible on
      // lastResponse.
      res.requestId = headers['request-id'];

      const requestDurationMs = Date.now() - req._requestStart;

      const responseEvent = util.removeEmptyProperties({
        api_version: headers['stripe-version'],
        account: headers['stripe-account'],
        idempotency_key: headers['idempotency-key'],
        method: req._requestEvent.method,
        path: req._requestEvent.path,
        status: res.statusCode,
        request_id: res.requestId,
        elapsed: requestDurationMs,
      });

      // this._stripe._emitter.emit('response', responseEvent);

      try {
        response = JSON.parse(response);

        if (response.error) {
          let err;

          // Convert OAuth error responses into a standard format
          // so that the rest of the error logic can be shared
          if (typeof response.error === 'string') {
            response.error = {
              type: response.error,
              message: response.error_description,
            };
          }

          response.error.headers = headers;
          response.error.statusCode = res.statusCode;
          response.error.requestId = res.requestId;

          if (res.statusCode === 401) {
            err = new Error.StripeAuthenticationError(response.error);
          } else if (res.statusCode === 403) {
            err = new Error.StripePermissionError(response.error);
          } else if (res.statusCode === 429) {
            err = new Error.StripeRateLimitError(response.error);
          } else {
            err = Error.StripeError.generate(response.error);
          }
          return callback.call(this, err, null);
        }
      } catch (e) {
        return callback.call(
          this,
          new Error.StripeAPIError({
            message: 'Invalid JSON received from the Campsimmer API',
            response,
            exception: e,
            requestId: headers['request-id'],
          }),
          null
        );
      }

      // this._recordRequestMetrics(res.requestId, requestDurationMs);

      // Expose res object
      Object.defineProperty(response, 'lastResponse', {
        enumerable: false,
        writable: false,
        value: res,
      });
      callback.call(this, null, response);
    });
  };
}

CampzimmerResource.prototype._generateConnectionErrorMessage = function(requestRetries) {
  return `An error occurred with our connection to Stripe.${
    requestRetries > 0 ? ` Request was retried ${requestRetries} times.` : ''
  }`;
}

CampzimmerResource.prototype._errorHandler = function(req, requestRetries, callback) {
  return (error) => {
    if (req._isAborted) {
      // already handled
      return;
    }
    callback.call(
      this,
      new Error.StripeConnectionError({
        message: this._generateConnectionErrorMessage(requestRetries),
        detail: error,
      }),
      null
    );
  };
};

module.exports = CampzimmerResource;
