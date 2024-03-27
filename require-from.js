const {promisify} = require('util');
const esbuild = require('esbuild');
const resolve = require('enhanced-resolve');
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

const resolveEntry = async (entry, fromDir) => {
  return myResolve(fromDir, entry);
};

const requireFromFile = async (filePath) => {
  if (/\/node_modules\//.test(filePath)) {
    return require(filePath);
  }
  const code = await bundle(filePath);
  return requireFromString(code);
};

const requireFromEntry = async (entry, fromDir) => {
  const filePath = await resolveEntry(entry, fromDir);
  if (!filePath) {
    throw new Error(`Cannot resolve ${entry}`);
  }
  return requireFromFile(filePath);
};

exports.resolveEntry = resolveEntry;
exports.requireFromFile = requireFromFile;
exports.requireFromEntry = requireFromEntry;
