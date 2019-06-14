# Campzimmer Node.js Library

The Campzimmer Node library provides convenient access to the Campzimmer API from
applications written in server-side JavaScript.

This package is for use with server-side Node that
uses a Campzimmer secret key. Utilization of this
package requires a Campzimmer secret key, and cannot
be circumvented. 

## Documentation

See the [Campzimmer docs](https://docs.campzimmer.com/).

## Installation

Install the package with:

    npm install campzimmer-node --save

## Usage

The package needs to be configured with your account's secret key which is
available in your [Campzimmer Dashboard][api-keys]. Require it with the key's
value:

```js
const campzimmer = require('campzimmer')('<secret_key>');
```

Or using ES modules, this looks more like:

```js
import Campzimmer from 'campzimmer-node';
const campzimmer = Stripe('<secret_key>');
//…
```
