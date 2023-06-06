/** @type {import('next').NextConfig} */

const Dotenv = require('dotenv-webpack');

module.exports = {
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },
  webpack: (config) => {
    config.plugins.push(new Dotenv({ silent: true }));
    return config;
  },
  output: "standalone",
  reactStrictMode: true,
}
