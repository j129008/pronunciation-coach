// One recording at a time, with a way out: finish() sends the take on for scoring, restart() throws the
// current take away (it is never scored) and starts a fresh one as soon as the old mic has closed,
// cancel() throws it away and goes idle. The mic itself is a pluggable backend so this is testable.
//
// backend.open(ctx) → Promise<{ finish(), discard(), done: Promise<result> }>
// onTake(result, ctx) is called only for takes that were finished (never for discarded ones).
// onState(state, ctx): 'idle' | 'starting' | 'recording' | 'stopping'
export function createRecorder({ backend, onTake = () => {}, onState = () => {}, onError = () => {} }) {
  let take = null, last = null;
  const set = (s, ctx) => onState(s, ctx);

  async function start(ctx) {
    if (take) return false;
    const t = take = { ctx, handle: null, discarded: false, restart: false, finishSoon: false };
    last = ctx;
    set('starting', ctx);
    try { t.handle = await backend.open(ctx); } catch (e) {
      if (take === t) take = null;
      set('idle', ctx);
      if (!t.discarded) onError(e, ctx); else if (t.restart) start(ctx);
      return false;
    }
    if (t.discarded) t.handle.discard();
    else if (t.finishSoon) { set('stopping', ctx); t.handle.finish(); } // stop was pressed while the mic was opening
    else set('recording', ctx);
    let res, err = null;
    try { res = await t.handle.done; } catch (e) { err = e; }
    if (take === t) take = null;
    set('idle', ctx);
    if (t.discarded) { if (t.restart) start(ctx); return false; }
    if (err) { onError(err, ctx); return false; }
    onTake(res, ctx);
    return true;
  }
  function finish() {
    const t = take;
    if (!t || t.discarded) return;
    if (!t.handle) { t.finishSoon = true; return; }
    set('stopping', t.ctx);
    t.handle.finish();
  }
  function discard(restart) {
    const t = take;
    if (!t) return false;
    t.discarded = true;
    t.restart = restart;
    if (t.handle) t.handle.discard();
    return true;
  }
  return {
    start,
    finish,
    // throw the current take away and record again (or just start, when idle)
    restart(ctx) { if (!discard(true)) start(ctx || last); },
    cancel() { discard(false); },
    // record / stop toggle for the big button
    toggle(ctx) { if (take) finish(); else start(ctx); },
    get busy() { return !!take; },
    get ctx() { return take ? take.ctx : null; },
  };
}
