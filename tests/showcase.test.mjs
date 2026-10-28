import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapShowcaseIndex, showcaseIndexForKey, normalizeShowcaseItems, createShowcase } from '../showcase.mjs';

test('showcase selection wraps backwards, forwards and across large offsets', () => {
  assert.equal(wrapShowcaseIndex(-1, 7), 6);
  assert.equal(wrapShowcaseIndex(7, 7), 0);
  assert.equal(wrapShowcaseIndex(22, 7), 1);
  assert.equal(wrapShowcaseIndex(-22, 7), 6);
  assert.equal(wrapShowcaseIndex(0, 1), 0);
});

test('invalid positions and unavailable lists keep a safe initial selection', () => {
  for (const position of [NaN, Infinity, undefined, '2', 1.2]) assert.equal(wrapShowcaseIndex(position, 7), 0);
  for (const size of [0, -1, NaN, Infinity, undefined, '7', 1.2]) assert.equal(wrapShowcaseIndex(4, size), 0);
});

test('keyboard navigation includes wrap, Home and End without consuming unrelated keys', () => {
  assert.equal(showcaseIndexForKey('ArrowLeft', 0, 7), 6);
  assert.equal(showcaseIndexForKey('ArrowRight', 6, 7), 0);
  assert.equal(showcaseIndexForKey('Home', 4, 7), 0);
  assert.equal(showcaseIndexForKey('End', 4, 7), 6);
  for (const key of ['Enter', ' ', 'Tab', 'ArrowDown', 'Escape', undefined]) assert.equal(showcaseIndexForKey(key, 3, 7), null);
  for (const count of [0, 1, -1, NaN, '7']) assert.equal(showcaseIndexForKey('ArrowRight', 0, count), null);
});

test('only real safe articles enter the showcase, with readable normalized content', () => {
  const items = normalizeShowcaseItems([
    null,
    { title: 'Bad', url: 'javascript:alert(1)' },
    { title: 'Credentials', url: 'https://user:secret@example.com/' },
    { title: ' First_Article ', url: 'https://en.wikipedia.org/wiki/First', description: 'A real description', thumbnail: 'https://upload.wikimedia.org/example.jpg' },
    { title: 'Duplicate', url: 'https://en.wikipedia.org/wiki/First' },
    { title: 'Second', url: 'https://en.wikipedia.org/wiki/Second', thumbnail: 'javascript:alert(1)' },
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0].url, 'https://en.wikipedia.org/wiki/First');
  assert.equal(items[0].title, 'First Article');
  assert.equal(items[0].description, 'A real description');
  assert.equal(items[1].title, 'Second');
  assert.equal(items[1].thumbnail, null);
  assert.equal(normalizeShowcaseItems({ items }).length, 0);
});

test('showcase limits preserve feed order and do not mutate source data', () => {
  const source = Array.from({ length: 15 }, (_, index) => ({ title: `Article_${index}`, url: `https://en.wikipedia.org/wiki/Article_${index}` }));
  const result = normalizeShowcaseItems(source);
  assert.equal(result.length, 12);
  assert.equal(result[0].title, 'Article 0');
  assert.equal(result.at(-1).title, 'Article 11');
  assert.equal(source[0].title, 'Article_0');
});

test('missing optional showcase markup cannot stop the working homepage', () => {
  const absent = createShowcase({ root: null });
  assert.doesNotThrow(() => { absent.setItems([]); absent.syncSaved(); });
  const incomplete = { hidden: false, querySelector: () => null };
  const inert = createShowcase({ root: incomplete });
  assert.equal(incomplete.hidden, true);
  assert.doesNotThrow(() => { inert.setItems([{ title: 'Moon', url: 'https://en.wikipedia.org/wiki/Moon' }]); inert.syncSaved(); });
});
