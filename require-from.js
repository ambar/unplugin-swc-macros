const {promisify} = require('util');
const esbuild = require('esbuild');
const resolve = require('enhanced-resolve');
const {builtinModules} = require('module');
const requireFromString = require('require-from-string');

/** @type {import('esbuild').Plugin} */
const nmExternalPlugin = {
  name: 'node-modules-external',
  setup(build) {
    // Must not start with "/" or "./" or "../"
    const filter = /^[^./]|^\.[^./]|^\.\.[^/]/;
    build.onResolve({filter}, (args) => ({path: args.path, external: true}));
  },
};

// Could replace this with a TS runtime tool, but the register/unregister hook is needed.
const bundle = async (file) => {
  const r = await esbuild.build({
    entryPoints: [file],
    bundle: true,
    write: false,
    platform: 'node',
    target: `node${process.version.slice(1)}`,
    // TODO: require ESM: https://github.com/nodejs/node/pull/51977
    // format: 'cjs',
    plugins: [nmExternalPlugin],
  });
  return r.outputFiles[0].text;
};

const myResolve = promisify(
  resolve.create({
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  })
);

const isBuiltin = (entry) => {
  return entry.startsWith('node:') || builtinModules.includes(entry);
};

const resolveEntry = async (entry, fromDir) => {
  if (isBuiltin(entry)) {
    return entry;
  }
  return myResolve(fromDir, entry);
};

const requireFrom = async (resolved) => {
  if (isBuiltin(resolved)) {
    return require(resolved);
  }
  if (/\/node_modules\//.test(resolved)) {
    return require(resolved);
  }
  const code = await bundle(resolved);
  return requireFromString(code);
};

const requireFromEntry = async (entry, fromDir) => {
  const filePath = await resolveEntry(entry, fromDir);
  if (!filePath) {
    throw new Error(`Cannot resolve ${entry}`);
  }
  return requireFrom(filePath);
};

exports.resolveEntry = resolveEntry;
exports.requireFrom = requireFrom;
exports.requireFromEntry = requireFromEntry;
