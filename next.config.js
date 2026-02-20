// next.config.js
const path = require("path");

module.exports = {
  experimental: {
    turbopack: {
      root: path.resolve(__dirname),
    },
  },
};