// Splits pasted article text into practice sentences (abbreviations, numbers, initials, quotes,
// markdown, hard-wrapped lines) — a heuristic splitter, meant to be corrected in the preview.
// Hard "never a sentence end" abbreviations:
const TITLES = new Set(['mr', 'mrs', 'ms', 'mx', 'dr', 'prof', 'sr', 'jr', 'mt', 'vs', 'fig', 'gen', 'gov', 'hon', 'rev', 'sgt', 'col', 'lt', 'capt', 'cf', 'approx', 'dept', 'ave', 'blvd',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'e.g', 'i.e']);
// Can also end a sentence: break only when the next word is a typical sentence starter.
const SOFT = new Set(['etc', 'inc', 'ltd', 'co', 'corp', 'st', 'no', 'al', 'a.m', 'p.m', 'u.s', 'u.k', 'ph.d']);
const STARTERS = new Set(['the', 'a', 'an', 'it', 'he', 'she', 'they', 'we', 'i', 'you', 'in', 'on', 'at', 'this', 'that', 'these', 'those', 'there', 'then', 'but', 'and', 'so', 'however',
  'after', 'before', 'when', 'if', 'as', 'my', 'his', 'her', 'our', 'their', 'what', 'how', 'why', 'who', 'today', 'yesterday', 'tomorrow', 'also', 'one', 'some', 'many', 'most', 'all',
  'for', 'to', 'with', 'by', 'from', 'not', 'now', 'here', 'next', 'finally', 'first']);
const CLOSERS = '"”’\')]»', OPENERS = '"“‘\'([«';

function cleanLine(l) {
  return l.replace(/[​﻿]/g, '')
    .replace(/^\s*#{1,6}\s+/, '').replace(/^\s*>+\s?/, '').replace(/^\s*([-*+•]|\d{1,3}[.)])\s+/, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|`)/g, '').replace(/(^|\s)[*_]+(?=\S)/g, '$1').replace(/(?<=\S)[*_]+(?=\s|$)/g, '')
    .replace(/\s+/g, ' ').trim();
}

// one paragraph (no hard breaks) → sentences
function splitParagraph(s) {
  const out = [], n = s.length;
  let start = 0;
  for (let i = 0; i < n; i++) {
    const ch = s[i];
    if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '…') continue;
    let j = i;
    while (j + 1 < n && '.!?…'.includes(s[j + 1])) j++;
    let k = j;
    while (k + 1 < n && CLOSERS.includes(s[k + 1])) k++;
    const run = s.slice(i, j + 1);
    if (k + 1 >= n) break;
    if (!/\s/.test(s[k + 1])) { i = k; continue; } // "3.5", "e.g.,", "U.S.A"
    let m = k + 1;
    while (m < n && /\s/.test(s[m])) m++;
    if (m >= n) break;
    let q = m;
    while (q < n && OPENERS.includes(s[q])) q++;
    const nc = s[q] || '', nextWord = (s.slice(q).match(/^[A-Za-z']+/) || [''])[0];
    const upper = /[A-Z]/.test(nc), digit = /\d/.test(nc);
    let brk;
    if (/[!?]/.test(run)) brk = upper || digit;
    else if (run.length > 1 || run === '…') brk = upper;
    else {
      const raw = (s.slice(0, i).match(/([A-Za-z][A-Za-z.]*)$/) || ['', ''])[1], tok = raw.toLowerCase();
      if (TITLES.has(tok)) brk = false;
      else if (/^[a-z]$/.test(tok)) brk = tok === 'i' ? upper : false; // initials: J. K. Rowling
      else if (SOFT.has(tok)) brk = upper && STARTERS.has(nextWord.toLowerCase());
      else brk = upper || digit;
    }
    if (brk) { out.push(s.slice(start, k + 1).trim()); start = m; }
    i = k;
  }
  out.push(s.slice(start).trim());
  return out;
}

export function splitSentences(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n').map(cleanLine);
  const paras = [];
  let cur = null, lastLen = 0;
  for (const ln of lines) {
    if (!ln) { if (cur != null) paras.push(cur); cur = null; continue; }
    if (cur == null) { cur = ln; lastLen = ln.length; continue; }
    const endsSentence = /[.!?…]["”’')\]]*$/.test(cur), startsLower = /^[a-z]/.test(ln);
    // a short line without ending punctuation followed by a capitalised line = heading / list item
    if (!endsSentence && !startsLower && lastLen < 55) { paras.push(cur); cur = ln; } else cur += ' ' + ln;
    lastLen = ln.length;
  }
  if (cur != null) paras.push(cur);
  return paras.flatMap(splitParagraph).map(x => x.trim()).filter(x => /[A-Za-z]/.test(x));
}

export const mergeLines = (a, b) => (String(a).trim() + ' ' + String(b).trim()).trim();
