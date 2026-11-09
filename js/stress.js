// Word stress + the short/long "i" from a reference pronunciation. Azure's phoneme rows carry no stress and
// often label an unstressed /ɪ/ (prefer = /prɪˈfɝ/) as /i/, which made the 注音 hint say 「長的ㄧ」.
// A reference IPA (the item's own `p`, or the small built-in list below) fixes both.
import { ipaNorm } from './phonemes.js';

const V1 = new Set(['ʌ', 'ɑ', 'æ', 'ɛ', 'ɪ', 'i', 'ʊ', 'u', 'ə', 'ɚ', 'ɝ', 'ɔ', 'ɒ', 'ɜ', 'ɐ', 'e', 'o', 'a', 'ɨ', 'ʉ', 'ɘ']);
const V2 = ['eɪ', 'aɪ', 'ɔɪ', 'aʊ', 'oʊ', 'əʊ', 'ɪə', 'ɛə', 'ʊə'];
const RV = new Set(['ɔɹ', 'ɑɹ', 'ɛɹ', 'ɪɹ', 'ʊɹ']); // Azure's r-coloured vowels (one row each)
export const isVowelRow = p => { const n = ipaNorm(p); return V1.has(n) || V2.includes(n) || RV.has(n); };

// "prɪˈfɝ" / "ʌmbɹˈɛlə" → [{v:'ɪ', stress:0}, {v:'ɝ', stress:1}]. ˈ may sit before the syllable or the vowel.
export function refVowels(ipa) {
  const s = String(ipa || '').replace(/[\/\[\]ː.\s]/g, '').replace(/ɜɹ|ɝɹ/g, 'ɝ').replace(/əɹ$/g, 'ɚ');
  const out = [];
  let pend = 0;
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === 'ˈ') { pend = 1; i++; continue; }
    if (c === 'ˌ') { pend = 2; i++; continue; }
    const two = s.slice(i, i + 2);
    if (V2.includes(two)) { out.push({ v: ipaNorm(two), stress: pend === 1 ? 1 : pend === 2 ? 2 : 0 }); pend = 0; i += 2; continue; }
    if (V1.has(c)) { out.push({ v: c === 'ɜ' ? 'ɝ' : c, stress: pend === 1 ? 1 : pend === 2 ? 2 : 0 }); pend = 0; i++; continue; }
    i++;
  }
  if (out.length && !out.some(x => x.stress === 1)) { if (out.length === 1) out[0].stress = 1; else return out.map(x => ({ v: x.v })); }
  return out;
}

// Common interview words with an unstressed first syllable that Azure tends to mark as a long /i/.
export const REF = {
  prefer: 'prɪˈfɝ', prepare: 'prɪˈpɛɹ', prevent: 'prɪˈvɛnt', predict: 'prɪˈdɪkt', present: 'prɪˈzɛnt', provide: 'prəˈvaɪd',
  require: 'rɪˈkwaɪɚ', receive: 'rɪˈsiv', remember: 'rɪˈmɛmbɚ', return: 'rɪˈtɝn', report: 'rɪˈpɔɹt', reply: 'rɪˈplaɪ', reduce: 'rɪˈdus',
  decide: 'dɪˈsaɪd', describe: 'dɪˈskɹaɪb', develop: 'dɪˈvɛləp', design: 'dɪˈzaɪn', deserve: 'dɪˈzɝv', delay: 'dɪˈleɪ', depend: 'dɪˈpɛnd',
  believe: 'bɪˈliv', become: 'bɪˈkʌm', because: 'bɪˈkʌz', before: 'bɪˈfɔɹ', begin: 'bɪˈɡɪn', behind: 'bɪˈhaɪnd',
  explain: 'ɪkˈspleɪn', expect: 'ɪkˈspɛkt', experience: 'ɪkˈspɪɹiəns', enjoy: 'ɪnˈdʒɔɪ', event: 'ɪˈvɛnt',
};

// Applies a reference IPA to one analyzed word: rows get `stress` (1 main, 2 secondary, 0 unstressed) on vowels, an /i/
// the reference has as unstressed /ɪ/ becomes /ɪ/, and /ɪ/ or a schwa said there is no longer an error.
// Returns a new word object (the input is not modified); unchanged when the vowel counts don't line up.
export function applyRef(w, ipa) {
  if (!w || !ipa || !w.rows) return w;
  const ref = refVowels(ipa);
  const vi = w.rows.map((r, i) => (isVowelRow(r.exp) ? i : -1)).filter(i => i >= 0);
  if (!ref.length || ref.length !== vi.length || !ref.some(x => x.stress != null)) return w;
  const rows = w.rows.map(r => ({ ...r }));
  vi.forEach((ri, k) => {
    const r = rows[ri], f = ref[k];
    r.stress = f.stress; // 1 main, 2 secondary, 0 unstressed
    const e = ipaNorm(r.exp);
    if (f.v === 'ɪ' && e === 'i' && f.stress !== 1) {
      r.exp = 'ɪ';
      const h = ipaNorm(r.heard);
      if (r.bad && (h === 'ɪ' || h === 'ə')) r.bad = false;
      if (!r.bad) r.heard = 'ɪ';
    }
  });
  return { ...w, rows, stressKnown: true };
}

// reference IPA for a word: the learner's own vocabulary items first, then the built-in list
export function refFor(word, items = []) {
  const k = String(word || '').toLowerCase().replace(/[^a-z']/g, '');
  if (!k) return '';
  const it = items.find(d => d && d.p && String(d.e || '').toLowerCase().replace(/[^a-z']/g, '') === k);
  return it ? it.p : REF[k] || '';
}
