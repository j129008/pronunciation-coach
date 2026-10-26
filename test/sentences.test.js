import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSentences, mergeLines } from '../js/sentences.js';

// synthetic text only
test('abbreviations, e.g., a.m./p.m. and U.S. do not end sentences (unless a sentence follows)', () => {
  assert.deepEqual(
    splitSentences('Mr. Smith went to Washington. He met Dr. Brown at 5 p.m. They talked about the U.S. economy, e.g. jobs.'),
    ['Mr. Smith went to Washington.', 'He met Dr. Brown at 5 p.m.', 'They talked about the U.S. economy, e.g. jobs.']);
  assert.deepEqual(splitSentences('We sell tools, toys, etc. They are cheap. It is in the U.S. The end.'),
    ['We sell tools, toys, etc.', 'They are cheap.', 'It is in the U.S.', 'The end.']);
});

test('numbers, decimals and money stay inside the sentence', () => {
  assert.deepEqual(splitSentences('The price rose 3.5 percent. It cost $2.50 per item. Version 2.0 is out!'),
    ['The price rose 3.5 percent.', 'It cost $2.50 per item.', 'Version 2.0 is out!']);
});

test('quotes: terminator + closing quote ends a sentence only before a capital', () => {
  assert.deepEqual(
    splitSentences('He said, "I\'m leaving." Then he left. "Why?" she asked. "Because it\'s late!" he replied.'),
    ['He said, "I\'m leaving."', 'Then he left.', '"Why?" she asked.', '"Because it\'s late!" he replied.']);
  assert.deepEqual(splitSentences('“Stop.” Then she ran.'), ['“Stop.”', 'Then she ran.']);
});

test('initials are not sentence ends, but "I." is', () => {
  assert.deepEqual(splitSentences('J. K. Rowling wrote it. I read it.'), ['J. K. Rowling wrote it.', 'I read it.']);
  assert.deepEqual(splitSentences('So did I. Then we left.'), ['So did I.', 'Then we left.']);
});

test('?/! only break before a capital; ellipsis handled', () => {
  assert.deepEqual(splitSentences('Really? yes, really! Great.'), ['Really? yes, really!', 'Great.']);
  assert.deepEqual(splitSentences('Well... I think so. Maybe... later.'), ['Well...', 'I think so.', 'Maybe... later.']);
});

test('markdown, headings, lists and hard-wrapped lines', () => {
  const text = '# Job Interview\n\nTom wants a job. He sent a\nresume today.\n- First tip\n- Second tip\n1. Wake up.\n\n**Bold** and _italic_ words. See [the site](http://x.test) now.';
  assert.deepEqual(splitSentences(text),
    ['Job Interview', 'Tom wants a job.', 'He sent a resume today.', 'First tip', 'Second tip', 'Wake up.', 'Bold and italic words.', 'See the site now.']);
});

test('windows newlines, blank input, non-text lines', () => {
  assert.deepEqual(splitSentences('One.\r\nTwo.\r\n\r\n---\r\n***\r\nThree.'), ['One.', 'Two.', 'Three.']);
  assert.deepEqual(splitSentences(''), []);
  assert.deepEqual(splitSentences(null), []);
  assert.deepEqual(splitSentences('   \n\n  '), []);
  assert.deepEqual(splitSentences('No final punctuation'), ['No final punctuation']);
});

test('mergeLines joins with one space', () => {
  assert.equal(mergeLines('Hello there. ', ' How are you?'), 'Hello there. How are you?');
});
