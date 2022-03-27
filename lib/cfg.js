const { existsSync, readFileSync } = require('fs');
const { dirname, resolve } = require('path');

const resolveMain = require('./resolve-main');

const defaultConfig = {
  clear: false,
  debounce: 10,
  dedupe: false,
  deps: 1,
  extensions: {
    coffee: 'coffeescript/register',
    ls: 'LiveScript',
    ts: 'ts-node/register'
  },
  fork: true,
  graceful_ipc: '',
  ignore: [],
  interval: 1000,
  notify: true,
  poll: false,
  respawn: false,
  timestamp: 'HH:MM:ss',
  vm: true
};

function read(dir) {
  const f = resolve(dir, '.node-dev.json');
  return existsSync(f) ? JSON.parse(readFileSync(f)) : {};
}

function getConfig(script) {
  const main = resolveMain(script);
  const dir = main ? dirname(main) : '.';

  return mergeConfig(
    defaultConfig,
    read(process.env.HOME || process.env.USERPROFILE),
    read(process.cwd()),
    read(dir)
  );
}

function mergeConfig(target, ...configs) {
  configs.forEach(config => {
    Object.entries(config).forEach(([key, value]) => {
      if (typeof value === 'undefined') return;
      const defaultValue = defaultConfig[key];
      if (Array.isArray(defaultValue)) {
        if (!target[key]) target[key] = [];
        target[key] = [].concat(target[key], value);
      } else if (typeof defaultValue === 'object') {
        target[key] = { ...target[key], ...value };
      } else {
        target[key] = value;
      }
    });
  });
  return target;
}

module.exports = {
  defaultConfig,
  getConfig,
  mergeConfig
};
