import {UnpluginInstance} from 'unplugin';

export interface MacroContext {
  addAsset: (asset: {type: string; content: string}) => void;
  invalidateOnFileChange: (filePath: string) => void;
  // Extra API, not part of the upstream unplugin API
  addWatchFile: (filePath: string) => void;
}

declare const plugin: UnpluginInstance<void>;
export = plugin;
