'use strict';
const CampzimmerResouce = require('../CampzimmerResource')
const CampzimmerAction = require('../CampzimmerResouceAction');


module.exports = CampzimmerResouce.extend({
    path: 'campgrounds',  
    search: CampzimmerAction({
      method: 'GET',
      path: '/search',
    })
});
