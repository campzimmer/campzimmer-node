'use strict';
const CampzimmerResouce = require('../CampzimmerResource')
const CampzimmerAction = require('../CampzimmerResouceAction');


module.exports = CampzimmerResouce.extend({
    path: 'campsites',  
    getThreeSixty: CampzimmerAction({
      method: 'GET',
      path: '/{campsite_id}/three-sixty',
    }),
    reserve: CampzimmerAction({
      method: 'POST',
      path: '/{campsite_id}/reserve'
    })
});
