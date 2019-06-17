'use strict';

const testUtils = require('./testUtil');
const util = require('../lib/util');
const campzimmer = require('../src/index')(testUtils.getUserCampzimmerKey());

const http = require('http');

const expect = require('chai').expect;

const CAMPSITE_DETAILS = {
  site_id: '12345'
};

describe('Campzimmer Module', function() {
  const cleanup = new testUtils.CleanupUtility();
  this.timeout(20000);

  describe('setApiKey', () => {
    it('uses Bearer auth', () => {
      expect(campzimmer.getApiField('auth')).to.equal(
        `Bearer ${testUtils.getUserCampzimmerKey()}`
      );
    });
  });

  describe('GetClientUserAgent', () => {
    it('Should return a user-agent serialized JSON object', () =>
      expect(
        new Promise((resolve, reject) => {
          campzimmer.getClientUserAgent((c) => {
            resolve(JSON.parse(c));
          });
        })
      ).to.eventually.have.property('lang', 'node'));
  });

  describe('GetClientUserAgentSeeded', () => {
    it('Should return a user-agent serialized JSON object', () => {
      const userAgent = {lang: 'node'};
      return expect(
        new Promise((resolve, reject) => {
          campzimmer.getClientUserAgentSeeded(userAgent, (c) => {
            resolve(JSON.parse(c));
          });
        })
      ).to.eventually.have.property('lang', 'node');
    });

    it('Should URI-encode user-agent fields', () => {
      const userAgent = {lang: 'ï'};
      return expect(
        new Promise((resolve, reject) => {
          campzimmer.getClientUserAgentSeeded(userAgent, (c) => {
            resolve(JSON.parse(c));
          });
        })
      ).to.eventually.have.property('lang', '%C3%AF');
    });

    describe('uname', () => {
      let origExec;
      beforeEach(() => {
        origExec = util.safeExec;
      });
      afterEach(() => {
        util.safeExec = origExec;
      });

      it('gets added to the user-agent', () => {
        util.safeExec = (cmd, cb) => {
          cb(null, 'foøname');
        };
        return expect(
          new Promise((resolve, reject) => {
            campzimmer.getClientUserAgentSeeded({lang: 'node'}, (c) => {
              resolve(JSON.parse(c));
            });
          })
        ).to.eventually.have.property('uname', 'fo%C3%B8name');
      });

      it('sets uname to UNKOWN in case of an error', () => {
        util.safeExec = (cmd, cb) => {
          cb(new Error('security'), null);
        };
        return expect(
          new Promise((resolve, reject) => {
            campzimmer.getClientUserAgentSeeded({lang: 'node'}, (c) => {
              resolve(JSON.parse(c));
            });
          })
        ).to.eventually.have.property('uname', 'UNKNOWN');
      });
    });
  });

  describe('setTimeout', () => {
    it('Should define a default equal to the node default', () => {
      expect(campzimmer.getApiField('timeout')).to.equal(
        http.createServer().timeout
      );
    });
    it('Should allow me to set a custom timeout', () => {
      campzimmer.setTimeout(900);
      expect(campzimmer.getApiField('timeout')).to.equal(900);
    });
    it('Should allow me to set null, to reset to the default', () => {
      campzimmer.setTimeout(null);
      expect(campzimmer.getApiField('timeout')).to.equal(
        http.createServer().timeout
      );
    });
  });

  describe('setAppInfo', () => {
    describe('when given nothing or an empty object', () => {
      it('should unset campzimmer._appInfo', () => {
        campzimmer.setAppInfo();
        expect(campzimmer._appInfo).to.be.undefined;
      });
    });

    describe('when given an object with no `name`', () => {
      it('should throw an error', () => {
        expect(() => {
          campzimmer.setAppInfo({});
        }).to.throw(/AppInfo.name is required/);

        expect(() => {
          campzimmer.setAppInfo({
            version: '1.2.3',
          });
        }).to.throw(/AppInfo.name is required/);

        expect(() => {
          campzimmer.setAppInfo({
            cats: '42',
          });
        }).to.throw(/AppInfo.name is required/);
      });
    });

    describe('when given at least a `name`', () => {
      it('should set name, partner ID, url, and version of campzimmer._appInfo', () => {
        campzimmer.setAppInfo({
          name: 'MyAwesomeApp',
        });
        expect(campzimmer._appInfo).to.eql({
          name: 'MyAwesomeApp',
        });

        campzimmer.setAppInfo({
          name: 'MyAwesomeApp',
          version: '1.2.345',
        });
        expect(campzimmer._appInfo).to.eql({
          name: 'MyAwesomeApp',
          version: '1.2.345',
        });

        campzimmer.setAppInfo({
          name: 'MyAwesomeApp',
          url: 'https://myawesomeapp.info',
        });
        expect(campzimmer._appInfo).to.eql({
          name: 'MyAwesomeApp',
          url: 'https://myawesomeapp.info',
        });

        campzimmer.setAppInfo({
          name: 'MyAwesomeApp',
          partner_id: 'partner_1234',
        });
        expect(campzimmer._appInfo).to.eql({
          name: 'MyAwesomeApp',
          partner_id: 'partner_1234',
        });
      });

      it('should ignore any invalid properties', () => {
        campzimmer.setAppInfo({
          name: 'MyAwesomeApp',
          partner_id: 'partner_1234',
          version: '1.2.345',
          url: 'https://myawesomeapp.info',
          countOfRadishes: 512,
        });
        expect(campzimmer._appInfo).to.eql({
          name: 'MyAwesomeApp',
          partner_id: 'partner_1234',
          version: '1.2.345',
          url: 'https://myawesomeapp.info',
        });
      });
    });

    it('should be included in the ClientUserAgent and be added to the UserAgent String', (done) => {
      const appInfo = {
        name: testUtils.getRandomString(),
        version: '1.2.345',
        url: 'https://myawesomeapp.info',
      };

      campzimmer.setAppInfo(appInfo);

      campzimmer.getClientUserAgent((uaString) => {
        expect(JSON.parse(uaString).application).to.eql(appInfo);

        expect(campzimmer.getAppInfoAsString()).to.eql(
          `${appInfo.name}/${appInfo.version} (${appInfo.url})`
        );

        done();
      });
    });
  });

  describe('Callback support', () => {
    describe('Any given endpoint', () => {
      it('Will call a callback if successful', () =>
        expect(
          new Promise((resolve, reject) => {
            campzimmer.campsites.getThreeSixty(CUSTOMER_DETAILS, (err, customer) => {
              cleanup.deleteCustomer(customer.id);
              resolve('Called!');
            });
          })
        ).to.eventually.equal('Called!'));

      it('Will expose HTTP response object', () =>
        expect(
          new Promise((resolve, reject) => {
            campzimmer.customers.create(CUSTOMER_DETAILS, (err, customer) => {
              cleanup.deleteCustomer(customer.id);

              const headers = customer.lastResponse.headers;
              expect(headers).to.contain.keys('request-id');

              expect(customer.lastResponse.requestId).to.match(/^req_/);
              expect(customer.lastResponse.statusCode).to.equal(200);

              resolve('Called!');
            });
          })
        ).to.eventually.equal('Called!'));

      it('Given an error the callback will receive it', () =>
        expect(
          new Promise((resolve, reject) => {
            campzimmer.customers.createSource(
              'nonExistentCustId',
              {card: {}},
              (err, customer) => {
                if (err) {
                  resolve('ErrorWasPassed');
                } else {
                  reject(new Error('NoErrorPassed'));
                }
              }
            );
          })
        ).to.eventually.become('ErrorWasPassed'));
    });
  });

  describe('errors', () => {
    it('Exports errors as types', () => {
      const campzimmer = require('../lib/campzimmer');
      expect(
        new campzimmer.errors.StripeInvalidRequestError({
          message: 'error',
        }).type
      ).to.equal('StripeInvalidRequestError');
    });
  });

  describe('setMaxNetworkRetries', () => {
    describe('when given an empty or non-number variable', () => {
      it('should error', () => {
        expect(() => {
          campzimmer.setMaxNetworkRetries('foo');
        }).to.throw(/maxNetworkRetries must be a number/);

        expect(() => {
          campzimmer.setMaxNetworkRetries();
        }).to.throw(/maxNetworkRetries must be a number/);
      });
    });
  });
});
