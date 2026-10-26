import { test } from 'node:test';
import assert from 'node:assert/strict';
import { norm, tokenize, n2w, ordw } from '../js/normalize.js';

test('number words', () => {
  assert.equal(n2w(0), 'zero');
  assert.equal(n2w(21), 'twenty one');
  assert.equal(n2w(105), 'one hundred five');
  assert.equal(n2w(1234), 'one thousand two hundred thirty four');
  assert.equal(ordw(1), 'first');
  assert.equal(ordw(22), 'twenty second');
  assert.equal(ordw(30), 'thirtieth');
});

test('kilometers ≡ km after a number', () => {
  assert.deepEqual(norm('10 kilometers'), norm('10 km'));
  assert.deepEqual(norm('10km'), ['ten', 'kilometer']);
  assert.deepEqual(norm('I walked 5 Kilometres.'), norm('i walked five km'));
});

test('digits ≡ spoken numbers', () => {
  assert.deepEqual(norm('I have 3 cats'), norm('I have three cats'));
  assert.deepEqual(norm('1,250'), norm('one thousand two hundred fifty'));
  assert.deepEqual(norm('3.5'), ['three', 'point', 'five']);
  assert.deepEqual(norm('the 2nd floor'), ['the', 'second', 'floor']);
});

test('money, percent, time', () => {
  assert.deepEqual(norm('$20'), ['twenty', 'dollar']);
  assert.deepEqual(norm('50%'), ['fifty', 'percent']);
  assert.deepEqual(norm('50 percent'), ['fifty', 'percent']);
  assert.deepEqual(norm('7:05pm'), ['seven', 'oh', 'five', 'pm']);
  assert.deepEqual(norm('10:30'), ['ten', 'thirty']);
});

test('contractions, spelling variants, punctuation, case', () => {
  assert.deepEqual(norm("Don't go!"), ['do', 'not', 'go']);
  assert.deepEqual(norm('don’t go'), ['do', 'not', 'go']);
  assert.deepEqual(norm('My favourite colour'), norm('my favorite color'));
  assert.deepEqual(norm('OK, okay'), ['ok', 'ok']);
  assert.deepEqual(norm('e.g. this'), ['for', 'example', 'this']);
  assert.deepEqual(norm('  ...  '), []);
});

test('tokenize keeps the display word and its keys', () => {
  const g = tokenize('It costs $5.50.');
  assert.equal(g[2].d, '$5.50.');
  assert.deepEqual(g[2].k, ['five', 'point', 'five', 'zero', 'dollar']);
});
