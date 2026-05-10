const path = require('path');

module.exports = {
  output: 'standalone',
  turbopack: {
    root: path.join(__dirname),
  },
  ...
};
