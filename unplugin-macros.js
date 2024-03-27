const {createUnplugin} = require('unplugin');
const {Type, transform} = require('./index');
const path = require('path');
const {requireFromFile, resolveEntry} = require('./require-from');

const types = {
  '.js': Type.JS,
  '.jsx': Type.JSX,
  '.ts': Type.TS,
  '.tsx': Type.TSX,
};

/** @type {import('unplugin').UnpluginInstance} */
module.exports = createUnplugin(() => {
  return {
    name: 'unplugin-macros',
    enforce: 'pre',
    transformInclude(id) {
      return /\.(js|jsx|ts|tsx)$/.test(id) && !id.includes('/node_modules/');
    },
    async transform(code, filePath) {
      if (!/with[\s\n]*\{\s*type:[\s\n]*['"]macro['"][\s\n]*\}/.test(code)) {
        return;
      }

      let imports = [];
      let res = await transform(types[path.extname(filePath)], code, async (_err, src, exportName, args, loc) => {
        let mod, modPath;
        try {
          modPath = await resolveEntry(src, path.dirname(filePath));
          mod = await requireFromFile(modPath);
          if (!Object.hasOwnProperty.call(mod, exportName)) {
            throw new Error(`"${src}" does not export "${exportName}".`);
          }
          // listen for file changes
          this.addWatchFile(modPath);
        } catch (err) {
          throw {
            kind: 1,
            message: err.message,
          };
        }

        try {
          if (typeof mod[exportName] === 'function') {
            let result = mod[exportName].apply(
              {
                addWatchFile: async (filePath) => {
                  const dir = path.dirname(modPath);
                  this.addWatchFile(await resolveEntry(filePath, dir));
                },
              },
              args
            );

            return result;
          } else {
            throw new Error(`"${exportName}" in "${src}" is not a function.`);
          }
        } catch (err) {
          // Remove unplugin-macros from stack and build string so Rust can process errors more easily.
          let stack = (err.stack || '').split('\n').slice(1);
          let message = err.message;
          for (let line of stack) {
            if (line.includes(__filename)) {
              break;
            }
            message += '\n' + line;
          }
          throw {
            kind: 2,
            message,
          };
        }
      });

      res.code += '\n' + imports.join('\n');
      return res;
    },
  };
});
