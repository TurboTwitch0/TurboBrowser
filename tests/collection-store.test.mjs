import test from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionStore } from '../collection-store.mjs';

function fixture(locks) {
  const data = new Map();
  let failed = false;
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem(key, value) {
      if (failed) throw new Error('Storage unavailable');
      data.set(key, value);
    },
  };
  const options = { key: 'items', normalize: value => Array.isArray(value) ? [...value] : [], storage: () => storage, locks };
  return { data, storage, options, fail: value => { failed = value; } };
}
const add = item => items => ({ items: items.includes(item) ? items : [...items, item] });

test('rapid operations and stale store instances preserve the latest collection', async () => {
  const { data, options } = fixture();
  const first = createCollectionStore(options);
  const second = createCollectionStore(options);
  first.read(); second.read();
  await first.update(add('A'));
  await Promise.all([second.update(add('B')), second.update(add('C')), second.update(add('B'))]);
  assert.deepEqual(JSON.parse(data.get('items')), ['A', 'B', 'C']);
  assert.deepEqual(first.read(), ['A', 'B', 'C']);
});

test('a failed write stays visit-only after storage recovers and preserves remote data', async () => {
  const { data, options, fail } = fixture();
  const store = createCollectionStore(options);
  await store.update(add('Stored'));
  fail(true);
  assert.equal((await store.update(add('Visit'))).stored, false);
  fail(false);
  data.set('items', JSON.stringify(['Stored', 'Remote']));
  assert.equal((await store.update(add('Another visit item'))).stored, false);
  assert.deepEqual(store.read(), ['Stored', 'Visit', 'Another visit item']);
  assert.deepEqual(JSON.parse(data.get('items')), ['Stored', 'Remote']);
  assert.deepEqual(createCollectionStore(options).read(), ['Stored', 'Remote']);
});

test('a blocked first read uses visit-only defaults without overwriting later permanent data', async () => {
  const { data, storage, options } = fixture();
  let blocked = true;
  const store = createCollectionStore({ ...options, storage: () => {
    if (blocked) throw new Error('Storage access denied');
    return storage;
  } });
  assert.deepEqual(store.read(), []);
  blocked = false;
  data.set('items', JSON.stringify(['Remote']));
  const result = await store.update(add('Visit'));
  assert.equal(result.stored, false);
  assert.deepEqual(store.read(), ['Visit']);
  assert.deepEqual(JSON.parse(data.get('items')), ['Remote']);
});

test('native lock callbacks read current data after waiting, with a safe restricted-browser fallback', async () => {
  let release;
  const waits = new Promise(resolve => { release = resolve; });
  const names = [];
  const { data, options } = fixture({ request: async (name, run) => { names.push(name); await waits; return run(); } });
  const store = createCollectionStore(options);
  const pending = store.update(add('Local'));
  data.set('items', JSON.stringify(['Remote']));
  release();
  await pending;
  assert.deepEqual(JSON.parse(data.get('items')), ['Remote', 'Local']);
  assert.deepEqual(names, ['turbobrowser-storage:items']);
  const fallback = createCollectionStore({ ...options, locks: { request: async () => { throw new Error('Restricted'); } } });
  await fallback.update(add('Fallback'));
  assert.deepEqual(JSON.parse(data.get('items')), ['Remote', 'Local', 'Fallback']);
});
