const { resolve } = require('path');
const parse = require('yargs-parser');

const { getConfig, mergeConfig } = require('./cfg');

const arrayify = v => (Array.isArray(v) ? [...v] : [v]);

const resolvePath = p => resolve(process.cwd(), p);

const configuration = {
  'camel-case-expansion': false,
  'dot-notation': false,
  'halt-at-non-option': true, // stop parsing once the script is identified
  'parse-numbers': false,
  'parse-positional-numbers': false,
  'strip-aliased': true
};

const nodeDevYargs = {
  boolean: ['clear', 'dedupe', 'fork', 'notify', 'poll', 'respawn', 'vm'],
  number: ['debounce', 'deps', 'interval'],
  string: ['graceful_ipc', 'ignore', 'timestamp'],
  configuration: {
    ...configuration,
    'unknown-options-as-args': true, // all unknown args belong to node or the script
    'populate--': true // prevent yargs from slurping `--` away from the script args
  }
};

/** These options are supported as strings only when the `=` separator is used */
const nodeAmbiguousString = ['inspect', 'inspect-brk'];

/**
 * Common Node/V8 arguments which we support forwarding without an explicit `--`
 * before the script argument. For example,
 * `node-dev --example script.js` cannot be parsed unambiguously without
 * declaring `example-bool-option` as an option taking zero arguments.
 */
const nodeYargs = {
  alias: { require: ['r'] },
  boolean: ['expose_gc', 'preserve-symlinks', 'no-deprecation', 'no-warnings'],
  string: ['require', ...nodeAmbiguousString],
  configuration: {
    ...configuration,
    'boolean-negation': false // preserve `--no-*` options
  }
};

const stringifyNodeArgs = opts =>
  Object.entries(opts)
    .sort(([a], [b]) => a - b)
    .reduce((out, [key, value]) => {
      const prefix = key.length === 1 ? '-' : '--';
      if (typeof value === 'boolean' || value === '\0') {
        if (value !== false) out.push(`${prefix}${key}`);
      } else if (typeof value !== 'undefined') {
        arrayify(value).forEach(v => out.push(`${prefix}${key}=${v}`));
      }
      return out;
    }, []);

const fixAmbiguousNodeArgs = args => {
  const ambiguousStringArgs = nodeAmbiguousString.map(key => `--${key}`);
  return args.map(arg => (ambiguousStringArgs.includes(arg) ? `${arg}=\0` : arg));
};

const normalizeOptions = opts => {
  // these options may be specified multiple times and have their values collected into an array
  const collect = ['ignore', 'require'];

  for (const [key, value] of Object.entries(opts)) {
    if (collect.includes(key)) {
      opts[key] = arrayify(value);
    } else if (Array.isArray(value)) {
      // mimic Node's behavior of only reading the final occurence of an option
      opts[key] = value.pop();
    }
  }
  return opts;
};

module.exports = argv => {
  const args = argv.slice(2);

  const { _: unknownArgs, '--': extraScriptArgs, ...nodeDevOpts } = parse(args, nodeDevYargs);
  const { _: scriptArgs, ...nodeOpts } = parse(fixAmbiguousNodeArgs(unknownArgs), nodeYargs);
  if (extraScriptArgs) {
    // eat the -- unless script arguments already exist
    if (scriptArgs.length) scriptArgs.push('--');
    scriptArgs.push(...extraScriptArgs);
  }
  const script = scriptArgs.shift();

  if (!script) {
    throw new Error('Usage: node-dev [options] [--] <script> [arguments]\n');
  }

  const opts = mergeConfig({}, getConfig(script), normalizeOptions(nodeDevOpts));
  opts.ignore = arrayify(opts.ignore).map(resolvePath);

  const nodeArgs = stringifyNodeArgs(nodeOpts);

  return { nodeArgs, opts, script, scriptArgs };
};
