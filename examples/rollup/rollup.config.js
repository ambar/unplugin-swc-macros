import macros from 'unplugin-parcel-macros';
import pkg from './package.json' assert {type: 'json'};

const deps = Object.keys({...pkg.dependencies, ...pkg.peerDependencies});
const reExternal = new RegExp(`^(${deps.join('|')})($|/)`);

export default {
  input: pkg.source,
  output: [
    {
      file: pkg.main,
      format: 'cjs',
      sourcemap: false,
    },
    {
      file: pkg.module,
      format: 'esm',
      sourcemap: false,
    },
  ],
  plugins: [
    //
    macros.rollup(),
  ],
  external: (id) => (deps.length ? reExternal.test(id) : false),
};
