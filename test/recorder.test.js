import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecorder } from '../js/recorder.js';

// fake mic: every open() makes a take that resolves with its own id when finished or discarded
function fakeMic({ failOpen = false } = {}) {
  const takes = [];
  const backend = {
    async open(ctx) {
      if (failOpen) throw new Error('denied');
      let resolve;
      const t = { ctx, finished: false, discarded: false, closed: false, done: new Promise(r => { resolve = r; }) };
      t.finish = () => { t.finished = true; t.closed = true; resolve({ take: takes.indexOf(t) }); };
      t.discard = () => { t.discarded = true; t.closed = true; resolve({ take: takes.indexOf(t) }); };
      takes.push(t);
      return t;
    },
  };
  return { backend, takes };
}
const tick = () => new Promise(r => setTimeout(r, 0));
function setup(opts) {
  const mic = fakeMic(opts), scored = [], states = [], errors = [];
  const rec = createRecorder({ backend: mic.backend, onTake: (res, ctx) => scored.push({ res, ctx }), onState: s => states.push(s), onError: e => errors.push(e.message) });
  return { mic, rec, scored, states, errors };
}

test('finish sends the take on for scoring', async () => {
  const { mic, rec, scored, states } = setup();
  rec.start({ kind: 'sentence' });
  await tick();
  assert.equal(rec.busy, true);
  rec.finish();
  await tick();
  assert.equal(rec.busy, false);
  assert.deepEqual(scored.map(s => s.res.take), [0]);
  assert.ok(mic.takes[0].finished);
  assert.deepEqual(states, ['starting', 'recording', 'stopping', 'idle']);
});

test('restart while recording discards the take (never scored) and immediately records a new one', async () => {
  const { mic, rec, scored } = setup();
  rec.start({ kind: 'sentence' });
  await tick();
  rec.restart();
  await tick(); await tick();
  assert.equal(mic.takes.length, 2, 'a second take was opened');
  assert.ok(mic.takes[0].discarded && !mic.takes[0].finished);
  assert.ok(mic.takes[0].closed, 'old mic closed before the new take');
  assert.equal(rec.busy, true, 'recording again');
  assert.equal(scored.length, 0, 'the bad take was not sent for assessment');
  rec.finish();
  await tick();
  assert.deepEqual(scored.map(s => s.res.take), [1]);
});

test('restart works for word practice and keeps the same context', async () => {
  const { mic, rec, scored } = setup();
  const ctx = { kind: 'word', word: 'prefer' };
  rec.start(ctx);
  await tick();
  rec.restart();
  await tick(); await tick();
  assert.equal(mic.takes[1].ctx, ctx);
  rec.finish();
  await tick();
  assert.equal(scored.length, 1);
  assert.equal(scored[0].ctx.word, 'prefer');
});

test('cancel discards and goes idle; restart pressed while the mic is still opening also discards', async () => {
  const { mic, rec, scored } = setup();
  rec.start({ kind: 'sentence' });
  await tick();
  rec.cancel();
  await tick();
  assert.equal(rec.busy, false);
  assert.equal(scored.length, 0);
  assert.equal(mic.takes.length, 1);
  rec.start({ kind: 'sentence' }); // mic not open yet
  rec.restart();
  await tick(); await tick(); await tick();
  assert.ok(mic.takes[1].discarded);
  assert.equal(mic.takes.length, 3);
  assert.equal(rec.busy, true);
  assert.equal(scored.length, 0);
});

test('stop pressed while the mic is opening finishes that take instead of opening a second mic', async () => {
  const { mic, rec, scored } = setup();
  rec.toggle({ kind: 'sentence' });
  rec.toggle({ kind: 'sentence' }); // double click before getUserMedia resolved
  await tick(); await tick();
  assert.equal(mic.takes.length, 1);
  assert.equal(scored.length, 1);
  assert.equal(rec.busy, false);
});

test('a second start while busy is ignored; open errors are reported', async () => {
  const { rec } = setup();
  rec.start({});
  assert.equal(await rec.start({}), false);
  const b = setup({ failOpen: true });
  await b.rec.start({});
  assert.deepEqual(b.errors, ['denied']);
  assert.equal(b.rec.busy, false);
});
