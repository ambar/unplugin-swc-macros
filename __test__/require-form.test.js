import {test, expect} from 'vitest';
import path from 'path';
import {requireFrom, resolveEntry} from '../require-from';

const relative = path.relative.bind(null, __dirname);

test('requireFrom: builtin', async () => {
  const resolved = await resolveEntry('path');
  expect(resolved).toMatchInlineSnapshot(`"path"`);

  const mod = await requireFrom(resolved);
  expect(mod.resolve).toBeInstanceOf(Function);
});

test('requireFrom: builtin - node:', async () => {
  const resolved = await resolveEntry('node:path');
  expect(resolved).toMatchInlineSnapshot(`"node:path"`);

  const mod = await requireFrom(resolved);
  expect(mod.resolve).toBeInstanceOf(Function);
});

test('requireFrom: TS - ESM', async () => {
  const resolved = await resolveEntry('./fixtures/mod', __dirname);
  expect(relative(resolved)).toMatchInlineSnapshot(`"fixtures/mod.ts"`);

  const mod = await requireFrom(resolved);
  expect(mod.foo).toBe('foo');
});
