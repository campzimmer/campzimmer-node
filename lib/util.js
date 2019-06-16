const utils = (module.exports = {
    capToLowerName : (name) => {
        return name[0].toLowerCase() + name.substring(1);
    },
    removeEmptyProperties : (obj) => {
        if (typeof obj !== 'object') {
            throw new Error('Argument must be an object');
          }
      
          Object.keys(obj).forEach((key) => {
            if (obj[key] === null || obj[key] === undefined) {
              delete obj[key];
            }
          });
      
          return obj;
    }
})
