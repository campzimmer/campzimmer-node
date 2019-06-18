'use strict';

const resources = require('../lib/resource');
const util = require('../lib/util');

Campzimmer.DEFAULT_HOST = 'api.campzimmer.com';
Campzimmer.DEFAULT_PORT = '443';
Campzimmer.PACKAGE_VERSION = require('../package.json').version;
Campzimmer.DEFAULT_BASE_PATH = '/public/v1/';
Campzimmer.USER_AGENT = '';
Campzimmer.DEFAULT_TIMEOUT = require('http').createServer().timeout;

Campzimmer.USER_AGENT = {
  bindings_version: Campzimmer.PACKAGE_VERSION,
  lang: 'node',
  lang_version: process.version,
  platform: process.platform,
  publisher: 'campzimmer',
  uname: null,
};

Campzimmer.USER_AGENT_SERIALIZED = null;
Campzimmer.MAX_NETWORK_RETRY_DELAY_SEC = 2;
Campzimmer.INITIAL_NETWORK_RETRY_DELAY_SEC = 0.5;

const APP_INFO_PROPERTIES = ['name', 'version', 'url', 'partner_id'];

Campzimmer.CampzimmerResouce = require('../lib/CampzimmerResource');
Campzimmer.resources = resources;

Campzimmer.errors = require('../lib/Error');

function Campzimmer(key) {
  if (!(this instanceof Campzimmer)) {
    return new Campzimmer(key);
  }

  this._api = {
    auth: null,
    host: Campzimmer.DEFAULT_HOST,
    port: Campzimmer.DEFAULT_PORT,
    basePath: Campzimmer.DEFAULT_BASE_PATH,
    timeout: Campzimmer.DEFAULT_TIMEOUT,
    package_version: Campzimmer.PACKAGE_VERSION,
    agent: null
  };

  this._prepResoures();

  this.setApiKey(key);
  this.setBasePath(Campzimmer.DEFAULT_HOST);
}

Campzimmer.prototype.setHost = function(host, port, protocol) {
  this._setApiField('host', host);
  if (port) {
    this.setPort(port);
  }
  if (protocol) {
    this.setProtocol(protocol);
  }
};

Campzimmer.prototype.setProtocol = function(protocol) {
  this._setApiField('protocol', protocol.toLowerCase());
};

Campzimmer.prototype.setPort = function(port) {
  this._setApiField('port', port);
};

Campzimmer.prototype.setApiVersion = function(version) {
  if (version) {
    this._setApiField('version', version);
  }
};

Campzimmer.prototype.setApiKey = function(key) {
  if (key) {
    this._setApiField('auth', `Bearer ${key}`);
  }
};

Campzimmer.prototype.setTimeout = function(timeout) {
  this._setApiField(
    'timeout',
    timeout == null ? Campzimmer.DEFAULT_TIMEOUT : timeout
  );
};

Campzimmer.prototype.setAppInfo = function(info) {
  if (info && typeof info !== 'object') {
    throw new Error('AppInfo must be an object.');
  }

  if (info && !info.name) {
    throw new Error('AppInfo.name is required');
  }

  info = info || {};

  const appInfo = APP_INFO_PROPERTIES.reduce((accum, prop) => {
    if (typeof info[prop] == 'string') {
      accum = accum || {};

      accum[prop] = info[prop];
    }

    return accum;
  }, undefined);

  // Kill the cached UA string because it may no longer be valid
  Campzimmer.USER_AGENT_SERIALIZED = undefined;

  this._appInfo = appInfo;
};

Campzimmer.prototype.setHttpAgent = function(agent) {
  this._setApiField('agent', agent);
};

Campzimmer.prototype.getApiField = function(field){
  if(field){
    return this._api[field];
  }
}

Campzimmer.prototype._setApiField = function(key, value) {
  this._api[key] = value;
};

Campzimmer.prototype.setApiKey = function(key) {
  if (key) {
    this._api.auth = `Bearer ${key}`;
  } else {
    throw new Error('You must set a valid secret');
  }
};

Campzimmer.prototype.getApiKey = function() {
  return this._api.auth;
};

Campzimmer.prototype.getBasePath = function() {
  return this._api.basePath;
};

Campzimmer.prototype.setBasePath = function(path) {
  this._api.basePath = path;
};

Campzimmer.prototype._prepResoures = function() {
  for (const name in resources) {
    this[util.capToLowerName(name)] = new resources[name](this);
  }
};

Campzimmer.prototype.setClientId = function(clientId) {
  this._clientId = clientId;
};

Campzimmer.prototype.getClientId = function() {
  return this._clientId;
};

// Get a global constant
Campzimmer.prototype.getConstant = function(c) {
  return Campzimmer[c];
};

Campzimmer.prototype.getMaxNetworkRetries = function() {
  return this.getApiField('maxNetworkRetries');
};

Campzimmer.prototype.setMaxNetworkRetries = function(maxNetworkRetries) {
  if (
    (maxNetworkRetries && typeof maxNetworkRetries !== 'number') ||
    arguments.length < 1
  ) {
    throw new Error('maxNetworkRetries must be a number.');
  }

  this._setApiField('maxNetworkRetries', maxNetworkRetries);
};

Campzimmer.prototype.getMaxNetworkRetryDelay = function() {
  return this.getConstant('MAX_NETWORK_RETRY_DELAY_SEC');
};

Campzimmer.prototype.getInitialNetworkRetryDelay = function() {
  return this.getConstant('INITIAL_NETWORK_RETRY_DELAY_SEC');
};

// Gets a JSON version of a User-Agent and uses a cached version for a slight
// speed advantage.
Campzimmer.prototype.getClientUserAgent = function(cb) {
  if (Campzimmer.USER_AGENT_SERIALIZED) {
    return cb(Campzimmer.USER_AGENT_SERIALIZED);
  }
  this.getClientUserAgentSeeded(Campzimmer.USER_AGENT, (cua) => {
    Campzimmer.USER_AGENT_SERIALIZED = cua;
    cb(Campzimmer.USER_AGENT_SERIALIZED);
  });
};

// Gets a JSON version of a User-Agent by encoding a seeded object and
// fetching a uname from the system.
Campzimmer.prototype.getClientUserAgentSeeded = function(seed, cb) {
  util.safeExec('uname -a', (err, uname) => {
    const userAgent = {};
    for (const field in seed) {
      userAgent[field] = encodeURIComponent(seed[field]);
    }

    // URI-encode in case there are unusual characters in the system's uname.
    userAgent.uname = encodeURIComponent(uname || 'UNKNOWN');

    if (this._appInfo) {
      userAgent.application = this._appInfo;
    }

    cb(JSON.stringify(userAgent));
  });
};

Campzimmer.prototype.getAppInfoAsString = function() {
  if (!this._appInfo) {
    return '';
  }

  let formatted = this._appInfo.name;

  if (this._appInfo.version) {
    formatted += `/${this._appInfo.version}`;
  }

  if (this._appInfo.url) {
    formatted += ` (${this._appInfo.url})`;
  }

  return formatted;
};

module.exports = Campzimmer;
// expose constructor as a named property to enable mocking with Sinon.JS
module.exports.Campzimmer = Campzimmer;
