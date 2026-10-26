// Text normalizer: turns a sentence into comparable word keys
// (numbers → words, units/abbreviations/contractions/spelling variants unified).
const CONTR = {
  "i'm": 'i am', "it's": 'it is', "don't": 'do not', "can't": 'cannot', "won't": 'will not', "i've": 'i have', "i'll": 'i will',
  "i'd": 'i would', "that's": 'that is', "there's": 'there is', "didn't": 'did not', "doesn't": 'does not', "isn't": 'is not',
  "we're": 'we are', "they're": 'they are', "you're": 'you are', "let's": 'let us',
};
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function n2w(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + n2w(n % 100) : '');
  for (const [v, w] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]) {
    if (n >= v) return n2w(Math.floor(n / v)) + ' ' + w + (n % v ? ' ' + n2w(n % v) : '');
  }
  return String(n);
}

const ORD = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };
export function ordw(n) {
  const w = n2w(n).split(' ');
  let l = w.pop();
  l = ORD[l] || (l.endsWith('y') ? l.slice(0, -1) + 'ieth' : l + 'th');
  return [...w, l].join(' ');
}

export function numWords(s) {
  s = s.replace(/,/g, '');
  const [i, d] = s.split('.');
  let r = n2w(parseInt(i, 10));
  if (d) r += ' point ' + d.split('').map(c => ONES[+c]).join(' ');
  return r;
}

const WMAP = {
  km: 'kilometer', kms: 'kilometer', kilometers: 'kilometer', kilometre: 'kilometer', kilometres: 'kilometer', meters: 'meter', metre: 'meter', metres: 'meter',
  miles: 'mile', minutes: 'minute', mins: 'minute', seconds: 'second', secs: 'second', sec: 'second', hours: 'hour', hrs: 'hour', hr: 'hour', pounds: 'pound', lbs: 'pound', lb: 'pound',
  kg: 'kilogram', kgs: 'kilogram', kilograms: 'kilogram', kilo: 'kilogram', kilos: 'kilogram', cm: 'centimeter', centimeters: 'centimeter', dollars: 'dollar', bucks: 'dollar',
  per: 'per', pct: 'percent', okay: 'ok', mister: 'mr', missus: 'mrs', doctor: 'dr', street: 'st', versus: 'vs', email: 'email',
  colour: 'color', colours: 'colors', favour: 'favor', favourite: 'favorite', behaviour: 'behavior', honour: 'honor', labour: 'labor', neighbour: 'neighbor', flavour: 'flavor', humour: 'humor', centre: 'center', theatre: 'theater', programme: 'program', travelling: 'traveling', travelled: 'traveled', cancelled: 'canceled',
};
const AFTERNUM = { m: 'meter', mi: 'mile', min: 'minute', s: 'second', h: 'hour', g: 'gram', ft: 'foot', feet: 'foot', mm: 'millimeter' };
const MULTI = { eg: 'for example', ie: 'that is', etc: 'etc' };
const NUMWORD = /^(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|point|a)$/;

function canonWord(w, prevNum) {
  if (prevNum && AFTERNUM[w]) return AFTERNUM[w];
  if (WMAP[w]) return WMAP[w];
  if (/i[sz](e|ed|es|ing|ation|ations)$/.test(w) && w.length > 5) w = w.replace(/iz(e|ed|es|ing|ation|ations)$/, 'is$1');
  return w;
}

// returns array of groups: {d: original display word, k: [keys]}
export function tokenize(s) {
  s = s.replace(/[’‘]/g, "'").replace(/\bet cetera\b/gi, 'etc').replace(/\bper cent\b/gi, 'percent').replace(/\be-mail/gi, 'email').replace(/\bo\.?k\.?\b/gi, 'ok');
  const out = [];
  let prevNum = false;
  for (const raw of s.split(/\s+/).filter(Boolean)) {
    const t = raw.toLowerCase().replace(/^[^a-z0-9$&]+|[^a-z0-9%&]+$/g, '');
    const keys = [];
    let isNum = false;
    let m;
    if (!t) continue;
    if (t === '&') keys.push('and');
    else if ((m = t.match(/^\$([\d,]+(?:\.\d+)?)([a-z]*)$/))) { keys.push(...numWords(m[1]).split(' '), 'dollar'); }
    else if ((m = t.match(/^([\d,]+(?:\.\d+)?)%$/))) { keys.push(...numWords(m[1]).split(' '), 'percent'); }
    else if ((m = t.match(/^(\d{1,2}):(\d{2})(am|pm)?$/))) {
      keys.push(...n2w(+m[1]).split(' '));
      const mm = +m[2];
      if (mm > 0) keys.push(...(mm < 10 ? 'oh ' + ONES[mm] : n2w(mm)).split(' '));
      if (m[3]) keys.push(m[3]);
    }
    else if ((m = t.match(/^(\d+)(st|nd|rd|th)$/))) { keys.push(...ordw(+m[1]).split(' ')); }
    else if ((m = t.match(/^(\d[\d,]*(?:\.\d+)?)([a-z]*)$/))) {
      keys.push(...numWords(m[1]).split(' '));
      isNum = true;
      if (m[2]) keys.push(canonWord(m[2], true));
    }
    else {
      const w0 = t.replace(/\./g, '');
      if (MULTI[w0]) keys.push(...MULTI[w0].split(' '));
      else for (const p of w0.split(/[-\/]+/)) {
        const w = p.replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
        if (!w) continue;
        if (/^\d+$/.test(w)) { keys.push(...n2w(+w).split(' ')); isNum = true; continue; }
        for (const x of (CONTR[w] || w).split(' ')) keys.push(canonWord(x, prevNum));
      }
    }
    if (keys.length) out.push({ d: raw, k: keys });
    prevNum = isNum || keys.every(k => NUMWORD.test(k)) && keys[0] !== 'a';
  }
  return out;
}

export function norm(s) {
  return tokenize(s).flatMap(g => g.k);
}
