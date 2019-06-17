'use strict';

const http = require('http');
const https = require('https');

const util = require('./util');

const httpAgent = new http.Agent({keepAlive: true});
const httpsAgent = new https.Agent({keepAlive: true});

/**
 * Encapsulates request logic for a Campzimmer Utilities
 */
function CampzimmerResource(campzimmer) {
  this._cz = campzimmer;

  this.basePath = campzimmer.getBasePath('basePath');
  this.resourcePath = this.path;
  this.path = util.makeURLInterpolator(this.path);
  this.initialize(...arguments);
}

CampzimmerResource.extend = util.protoExtend;

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
  console.log("PATTTTHHH:", path);
  console.log("PATTTTHHH:", this.path);
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
      return this._responseHandler(req, callback)(res);
    });

    req.on('error', (error) => {
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

module.exports = CampzimmerResource;
