(function (factory) {
  typeof define === 'function' && define.amd ? define(factory) :
  factory();
}(function () { 'use strict';

  const foo = 'hello world!';

  const main = function () {
    console.log(foo);
  };

  module.exports = main;

}));
