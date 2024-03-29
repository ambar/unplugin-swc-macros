const {createUnplugin} = require('unplugin');
const {Type, transform} = require('./index');
const path = require('path');
const crypto = require('crypto');
const SourceMap = require('@parcel/source-map').default;
const {requireFromFile, resolveEntry} = require('./require-from');

const types = {
  '.js': Type.JS,
  '.jsx': Type.JSX,
  '.ts': Type.TS,
  '.tsx': Type.TSX,
};

let assets = new Map();
let assetsByFile = new Map();

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

      // Remove old assets.
      let currentAssets = assetsByFile.get(filePath);
      if (currentAssets) {
        for (let asset of currentAssets) {
          assets.delete(asset);
        }
      }
      currentAssets = [];
      assetsByFile.set(filePath, currentAssets);

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
            let macroAssets = [];
            let addWatchFile = async (id) => {
              this.addWatchFile(await resolveEntry(id, path.dirname(modPath)));
            };
            let result = mod[exportName].apply(
              {
                addAsset(asset) {
                  macroAssets.push(asset);
                },
                invalidateOnFileChange: addWatchFile,
                // Extra API, not part of the upstream unplugin API
                addWatchFile: addWatchFile,
                // Cannot use `this.emitFile`, it's only available during build phase.
              },
              args
            );

            for (let asset of macroAssets) {
              let hash = crypto.createHash('sha256');
              hash.update(asset.content);
              let id = `${filePath}.macro-${hash.digest('hex')}.${asset.type}`;
              assets.set(id, asset);
              currentAssets.push(id);
              imports.push(`import "${id}";`);

              // Generate a source map that maps each line of the asset to the original macro call.
              let map = new SourceMap(process.cwd());
              let mappings = [];
              let line = 1;
              for (let i = 0; i <= asset.content.length; i++) {
                if (i === asset.content.length || asset.content[i] === '\n') {
                  mappings.push({
                    generated: {
                      line,
                      column: 0,
                    },
                    source: filePath,
                    original: {
                      line: loc.line,
                      column: loc.col,
                    },
                  });
                  line++;
                }
              }

              map.addIndexedMappings(mappings);
              map.setSourceContent(filePath, code);
              asset.content += `\n/*# sourceMappingURL=${await map.stringify({format: 'inline'})} */`;
            }

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
    resolveId(id) {
      if (assets.has(id)) {
        return id;
      }
    },
    loadInclude(id) {
      return assets.has(id);
    },
    load(id) {
      return assets.get(id).content;
    },
  };
});
