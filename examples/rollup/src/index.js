import {add, getPromise} from './macro' with {type: 'macro'};

console.log( [
  add(1, 2),
  getPromise(),
])
