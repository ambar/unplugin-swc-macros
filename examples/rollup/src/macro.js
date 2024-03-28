export const add = (a, b) => a + b;

import {foo} from './deps';
export const getPromise = async function () {
  this.addWatchFile('./deps');
  return [foo];
};
