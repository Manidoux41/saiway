const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
config.watchFolders = [
  ...config.watchFolders,
  path.resolve(__dirname, '../lib'),
  path.resolve(__dirname, '../components/i18n'),
];

module.exports = config;
