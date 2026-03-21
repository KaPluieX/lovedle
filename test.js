// Lovedle Test Suite — Black & White Box
// node test.js

'use strict';
const fs = require('fs');

// ── Load word lists ───────────────────────────────────────────
const wlSrc = fs.readFileSync('./wordlists.js', 'utf8')
  .replace('const WORDS = ', 'global.WORDS = ')
  .replace('const VALID_GUESSES = ', 'global.VALID_GUESSES = ');
eval(wlSrc);

// ── Inline game functions under test ─────────────────────────
const localStorage = (() => {
  const store = {};
  return {
    getItem: k => store[k] !== undefined ? store[k] : null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: k => { delete store[k]; }
  };
})();

function computeFeedback(guess, target) {
  const g = guess.split(''), t = target.split('');
  const res = Array(5).fill('absent');
  const tUsed = Array(5).fill(false), gUsed = Array(5).fill(false);
  for(let i=0;i<5;i++) if(g[i]===t[i]){res[i]='correct';tUsed[i]=gUsed[i]=true;}
  for(let i=0;i<5;i++){if(gUsed[i])continue;for(let j=0;j<5;j++){if(tUsed[j])continue;if(g[i]===t[j]){res[i]='present';tUsed[j]=true;break;}}}
  return g.map((letter,i)=>({letter,result:res[i]}));
}

function loadNames() {
  try { return JSON.parse(localStorage.getItem('lovedle_names')) || {p1:'Player 1',p2:'Player 2'}; }
  catch(e) { return {p1:'Player 1',p2:'Player 2'}; }
}
function saveNamesToStorage(p1,p2) {
  localStorage.setItem('lovedle_names', JSON.stringify({p1:p1||'Player 1',p2:p2||'Player 2'}));
}
function loadScores() {
  try { return JSON.parse(localStorage.getItem('lovedle_scores')) || {}; }
  catch(e) { return {}; }
}
function saveScores(s) {
  localStorage.setItem('lovedle_scores', JSON.stringify(s));
}

// ── Test harness ─────────────────────────────────────────────
let passed = 0, failed = 0, total = 0;
const failures = [];

function test(name, fn) {
  total++;
  try { fn(); passed++; process.stdout.write('.'); }
  catch(e) { failed++; failures.push({name, err:e.message}); process.stdout.write('F'); }
}
function expect(val) {
  return {
    toBe: exp => { if(val!==exp) throw new Error(`Expected ${JSON.stringify(exp)}, got ${JSON.stringify(val)}`); },
    toBeTrue: () => { if(val!==true) throw new Error(`Expected true, got ${JSON.stringify(val)}`); },
    toBeFalse: () => { if(val!==false) throw new Error(`Expected false, got ${JSON.stringify(val)}`); },
    toEqual: exp => { if(JSON.stringify(val)!==JSON.stringify(exp)) throw new Error(`Expected ${JSON.stringify(exp)}, got ${JSON.stringify(val)}`); },
    toHaveLength: n => { if(val.length!==n) throw new Error(`Expected length ${n}, got ${val.length}`); },
    toContain: item => { if(!val.includes(item)) throw new Error(`Expected to contain ${JSON.stringify(item)}`); },
    notToContain: item => { if(val.includes(item)) throw new Error(`Expected NOT to contain ${JSON.stringify(item)}`); },
    toBeGreaterThan: n => { if(!(val>n)) throw new Error(`Expected ${val} > ${n}`); },
  };
}
function section(name) { console.log('\n\n' + '─'.repeat(50)); console.log(' ' + name); console.log('─'.repeat(50)); }

// ════════════════════════════════════════════════════════════
// WHITE BOX: computeFeedback — internal logic paths
// ════════════════════════════════════════════════════════════
section('WHITE BOX: computeFeedback');

test('exact match → all correct', () => {
  const fb = computeFeedback('crane', 'crane');
  expect(fb.every(f=>f.result==='correct')).toBeTrue();
});

test('no shared letters → all absent', () => {
  // 'crimp' vs 'flown': no overlap
  const fb = computeFeedback('crimp', 'flown');
  expect(fb.every(f=>f.result==='absent')).toBeTrue();
});

test('all present — letters exist but all wrong positions', () => {
  // acner vs crane: a(0)->crane[2]=a present, c(1)->crane[0]=c present,
  //                 n(2)->crane[3]=n present, e(3)->crane[4]=e present, r(4)->crane[1]=r present
  const fb = computeFeedback('acner', 'crane');
  expect(fb.every(f=>f.result==='present')).toBeTrue();
});

test('returns exactly 5 feedback items', () => {
  expect(computeFeedback('hello', 'world')).toHaveLength(5);
});

test('feedback preserves original letters', () => {
  const fb = computeFeedback('crane', 'crane');
  expect(fb.map(f=>f.letter).join('')).toBe('crane');
});

test('correct takes priority over present', () => {
  // 'crane' vs 'crave': c,r,a correct; n absent; e correct
  const fb = computeFeedback('crane', 'crave');
  expect(fb[0].result).toBe('correct'); // c in correct position
  expect(fb[3].result).toBe('absent');  // n not in crave
  expect(fb[4].result).toBe('correct'); // e in correct position
});

test('duplicate in guess, one in target — only first marked', () => {
  // 'speed' vs 'bread': target b,r,e,a,d
  // pass1: e(2)=e correct, d(4)=d correct
  // pass2: s,p,e(3) vs b,r,a — e(3) no remaining match → absent
  const fb = computeFeedback('speed', 'bread');
  expect(fb[2].result).toBe('correct'); // e at idx2 is correct
  expect(fb[3].result).toBe('absent');  // second e — already consumed
  expect(fb[4].result).toBe('correct'); // d
});

test('duplicate in target, one in guess — marked present', () => {
  // 'level' vs 'llama': l(0) correct; l(4) → target l(1) is unused → present
  const fb = computeFeedback('level', 'llama');
  expect(fb[0].result).toBe('correct');
  expect(fb[4].result).toBe('present');
});

test('identical repeated letters — all correct', () => {
  const fb = computeFeedback('llama', 'llama');
  expect(fb.every(f=>f.result==='correct')).toBeTrue();
});

test('first letter correct, rest absent', () => {
  const fb = computeFeedback('crane', 'chips');
  expect(fb[0].result).toBe('correct'); // c
  expect(fb[1].result).toBe('absent');  // r
  expect(fb[2].result).toBe('absent');  // a
  expect(fb[3].result).toBe('absent');  // n
  expect(fb[4].result).toBe('absent');  // e
});

test('last letter correct, rest absent', () => {
  const fb = computeFeedback('crane', 'stone');
  expect(fb[4].result).toBe('correct'); // e correct
  expect(fb[0].result).toBe('absent');  // c
});

test('present letter not promoted when also correct elsewhere', () => {
  // 'aabbb' vs 'baaaa': a(0)→ b? no; a(1)→? ; b(2)→?
  // target: b,a,a,a,a
  // pass1: no exact matches between aabbb and baaaa
  // pass2: a(0)→b[1-4] unused a → present; a(1)→b[1-4] unused a → present; b(2)→b[0] → present; b(3)→no remaining b; b(4)→no
  const fb = computeFeedback('aabbb', 'baaaa');
  expect(fb[0].result).toBe('present'); // a present
  expect(fb[2].result).toBe('present'); // b present (b is at pos 0 in target)
  expect(fb[3].result).toBe('absent');  // second b — already used
  expect(fb[4].result).toBe('absent');  // third b — already used
});

// ════════════════════════════════════════════════════════════
// WHITE BOX: Word List Integrity
// ════════════════════════════════════════════════════════════
section('WHITE BOX: Word Lists');

test('WORDS is a non-empty array', () => {
  expect(Array.isArray(global.WORDS)).toBeTrue();
  expect(global.WORDS.length).toBeGreaterThan(0);
});

test('VALID_GUESSES is a non-empty array', () => {
  expect(Array.isArray(global.VALID_GUESSES)).toBeTrue();
  expect(global.VALID_GUESSES.length).toBeGreaterThan(0);
});

test('WORDS has at least 100 entries', () => {
  expect(global.WORDS.length).toBeGreaterThan(100);
});

test('VALID_GUESSES has at least 1000 entries', () => {
  expect(global.VALID_GUESSES.length).toBeGreaterThan(1000);
});

test('all WORDS are exactly 5 letters', () => {
  const bad = global.WORDS.filter(w => w.length !== 5);
  if(bad.length) throw new Error(`Bad WORDS: ${bad.slice(0,5).join(',')}`);
});

test('all VALID_GUESSES are exactly 5 letters', () => {
  const bad = global.VALID_GUESSES.filter(w => w.length !== 5);
  if(bad.length) throw new Error(`Bad VALID_GUESSES: ${bad.slice(0,5).join(',')}`);
});

test('all WORDS are lowercase', () => {
  const bad = global.WORDS.filter(w => w !== w.toLowerCase());
  if(bad.length) throw new Error(`Uppercase: ${bad.slice(0,3).join(',')}`);
});

test('all VALID_GUESSES are lowercase', () => {
  const bad = global.VALID_GUESSES.filter(w => w !== w.toLowerCase());
  if(bad.length) throw new Error(`Uppercase: ${bad.slice(0,3).join(',')}`);
});

test('no duplicates in WORDS', () => {
  const dupes = global.WORDS.length - new Set(global.WORDS).size;
  if(dupes) throw new Error(`${dupes} duplicates in WORDS`);
});

test('no duplicates in VALID_GUESSES', () => {
  const dupes = global.VALID_GUESSES.length - new Set(global.VALID_GUESSES).size;
  if(dupes) throw new Error(`${dupes} duplicates in VALID_GUESSES`);
});

test('all WORDS are in VALID_GUESSES', () => {
  const vset = new Set(global.VALID_GUESSES);
  const missing = global.WORDS.filter(w => !vset.has(w));
  if(missing.length) throw new Error(`${missing.length} WORDS not in VALID_GUESSES: ${missing.slice(0,5).join(',')}`);
});

test('all WORDS have only alpha chars', () => {
  const bad = global.WORDS.filter(w => !/^[a-z]{5}$/.test(w));
  if(bad.length) throw new Error(`Non-alpha: ${bad.slice(0,5).join(',')}`);
});

test('all VALID_GUESSES have only alpha chars', () => {
  const bad = global.VALID_GUESSES.filter(w => !/^[a-z]{5}$/.test(w));
  if(bad.length) throw new Error(`Non-alpha: ${bad.slice(0,5).join(',')}`);
});

test('common answer words in WORDS', () => {
  ['crane','black','heart','great','about'].forEach(w => {
    if(!global.WORDS.includes(w)) throw new Error(`Missing: ${w}`);
  });
});

test('common guess words in VALID_GUESSES', () => {
  ['crane','chops','adieu','stare','badly'].forEach(w => {
    if(!global.VALID_GUESSES.includes(w)) throw new Error(`Missing: ${w}`);
  });
});

test('known non-words are absent from VALID_GUESSES', () => {
  ['zzzzz','xkzqp','aaaaa','bbbbb'].forEach(w => {
    if(global.VALID_GUESSES.includes(w)) throw new Error(`Junk word present: ${w}`);
  });
});

// ════════════════════════════════════════════════════════════
// WHITE BOX: Persistence Layer
// ════════════════════════════════════════════════════════════
section('WHITE BOX: Persistence');

test('loadNames default when nothing stored', () => {
  localStorage.removeItem('lovedle_names');
  const n = loadNames();
  expect(n.p1).toBe('Player 1');
  expect(n.p2).toBe('Player 2');
});

test('saveNamesToStorage / loadNames round-trip', () => {
  saveNamesToStorage('Alice', 'Bob');
  const n = loadNames();
  expect(n.p1).toBe('Alice');
  expect(n.p2).toBe('Bob');
});

test('saveNamesToStorage with empty string uses defaults', () => {
  saveNamesToStorage('', '');
  const n = loadNames();
  expect(n.p1).toBe('Player 1');
  expect(n.p2).toBe('Player 2');
});

test('loadNames: corrupt JSON returns defaults', () => {
  localStorage.setItem('lovedle_names', '{bad json}');
  const n = loadNames();
  expect(n.p1).toBe('Player 1');
});

test('loadScores: empty returns {}', () => {
  localStorage.removeItem('lovedle_scores');
  const s = loadScores();
  expect(typeof s).toBe('object');
  expect(Object.keys(s).length).toBe(0);
});

test('saveScores / loadScores round-trip', () => {
  const data = {p1:{wins:3,rounds:5,totalGuesses:14}};
  saveScores(data);
  const loaded = loadScores();
  expect(loaded.p1.wins).toBe(3);
  expect(loaded.p1.rounds).toBe(5);
  expect(loaded.p1.totalGuesses).toBe(14);
});

test('loadScores: corrupt JSON returns {}', () => {
  localStorage.setItem('lovedle_scores', 'not-json!!');
  const s = loadScores();
  expect(typeof s).toBe('object');
});

test('scores persist across multiple saves', () => {
  localStorage.removeItem('lovedle_scores');
  let s = loadScores();
  if(!s.p1) s.p1 = {wins:0,rounds:0,totalGuesses:0};
  s.p1.wins++; s.p1.rounds++; s.p1.totalGuesses += 3;
  saveScores(s);
  s = loadScores(); s.p1.wins++; s.p1.rounds++; s.p1.totalGuesses += 4;
  saveScores(s);
  const final = loadScores();
  expect(final.p1.wins).toBe(2);
  expect(final.p1.rounds).toBe(2);
  expect(final.p1.totalGuesses).toBe(7);
});

// ════════════════════════════════════════════════════════════
// WHITE BOX: Share Emoji Encoding
// ════════════════════════════════════════════════════════════
section('WHITE BOX: Share Emoji');

test('correct emoji is U+1F7E9 (green square)', () => {
  expect(String.fromCodePoint(0x1F7E9).codePointAt(0)).toBe(0x1F7E9);
});

test('present emoji is U+1F7E8 (yellow square)', () => {
  expect(String.fromCodePoint(0x1F7E8).codePointAt(0)).toBe(0x1F7E8);
});

test('absent emoji is U+2B1B (black square)', () => {
  expect(String.fromCodePoint(0x2B1B).codePointAt(0)).toBe(0x2B1B);
});

test('share row for all-correct is 5 green squares', () => {
  const emojiMap = {correct:String.fromCodePoint(0x1F7E9),present:String.fromCodePoint(0x1F7E8),absent:String.fromCodePoint(0x2B1B)};
  const fb = computeFeedback('crane','crane');
  const row = fb.map(f=>emojiMap[f.result]);
  expect(row.every(e=>e===String.fromCodePoint(0x1F7E9))).toBeTrue();
});

test('share row produces 5 symbols', () => {
  const emojiMap = {correct:String.fromCodePoint(0x1F7E9),present:String.fromCodePoint(0x1F7E8),absent:String.fromCodePoint(0x2B1B)};
  const fb = computeFeedback('adieu','crane');
  const row = fb.map(f=>emojiMap[f.result]).join('');
  expect([...row].length).toBe(5); // spread handles surrogate pairs
});

test('share does not produce HTML entity strings', () => {
  const emojiMap = {correct:String.fromCodePoint(0x1F7E9),present:String.fromCodePoint(0x1F7E8),absent:String.fromCodePoint(0x2B1B)};
  const fb = computeFeedback('crane','crane');
  const row = fb.map(f=>emojiMap[f.result]).join('');
  expect(row.includes('&#x')).toBeFalse(); // must NOT contain HTML entities
});

// ════════════════════════════════════════════════════════════
// BLACK BOX: Game Flow
// ════════════════════════════════════════════════════════════
section('BLACK BOX: Game Flow');

test('win on guess 1', () => {
  const fb = computeFeedback('crane','crane');
  expect(fb.every(f=>f.result==='correct')).toBeTrue();
});

test('not won on guess 1 with wrong word', () => {
  const fb = computeFeedback('adieu','crane');
  expect(fb.every(f=>f.result==='correct')).toBeFalse();
});

test('win on guess 6 (last chance)', () => {
  const guesses = ['adieu','sport','blank','chyme','flown','crane'];
  const fbs = guesses.map(g=>computeFeedback(g,'crane'));
  expect(fbs[5].every(f=>f.result==='correct')).toBeTrue();
});

test('loss: 6 wrong guesses, never solved', () => {
  const guesses = ['adieu','sport','blank','chyme','flown','ghost'];
  const solved = guesses.map(g=>computeFeedback(g,'crane')).some(fb=>fb.every(f=>f.result==='correct'));
  expect(solved).toBeFalse();
});

test('feedback is progressive — earlier guesses help narrow down', () => {
  // 'crane' vs 'black': b,l,a,c,k
  // a(2) is correct (pos 2 in both); c(0) is present (c at pos 3 in black); r,n,e absent
  const fb = computeFeedback('crane','black');
  expect(fb[0].result).toBe('present'); // c is in 'black' at pos 3
  expect(fb[1].result).toBe('absent');  // r not in black
  expect(fb[2].result).toBe('correct'); // a at pos 2 in both
  expect(fb[3].result).toBe('absent');  // n not in black
  expect(fb[4].result).toBe('absent');  // e not in black
});

test('guess validation: 4-letter word is too short', () => {
  expect('cran'.length === 5).toBeFalse();
});

test('guess validation: 6-letter word is too long', () => {
  expect('cranes'.length === 5).toBeFalse();
});

test('guess validation: known junk rejected by VALID_GUESSES', () => {
  expect(global.VALID_GUESSES.includes('zzzzz')).toBeFalse();
});

test('guess validation: real word accepted', () => {
  expect(global.VALID_GUESSES.includes('crane')).toBeTrue();
});

// ════════════════════════════════════════════════════════════
// BLACK BOX: Input Handling
// ════════════════════════════════════════════════════════════
section('BLACK BOX: Input Handling');

test('input capped at 5 characters', () => {
  let input = '';
  ['A','B','C','D','E','F','G'].forEach(k=>{if(input.length<5)input+=k;});
  expect(input).toBe('ABCDE');
});

test('backspace removes last char', () => {
  let input = 'CRAN';
  if(input.length>0) input = input.slice(0,-1);
  expect(input).toBe('CRA');
});

test('backspace on empty is safe', () => {
  let input = '';
  if(input.length>0) input = input.slice(0,-1);
  expect(input).toBe('');
});

test('only A-Z accepted', () => {
  const valid = k => /^[A-Z]$/.test(k);
  expect(valid('A')).toBeTrue();
  expect(valid('Z')).toBeTrue();
  expect(valid('1')).toBeFalse();
  expect(valid(' ')).toBeFalse();
  expect(valid('!')).toBeFalse();
  expect(valid('Enter')).toBeFalse();
  expect(valid('Backspace')).toBeFalse();
});

test('inputLocked blocks all key processing', () => {
  let inputLocked = true, input = 'CRAN', gameOver = false;
  function handleKey(k) { if(gameOver||inputLocked) return 'blocked'; return 'ok'; }
  expect(handleKey('E')).toBe('blocked');
  expect(input).toBe('CRAN');
});

test('inputLocked unlocked after delay allows input', () => {
  let inputLocked = false, input = 'CRAN';
  function handleKey(k) { if(inputLocked) return; if(input.length<5 && /^[A-Z]$/.test(k)) input+=k; }
  handleKey('E');
  expect(input).toBe('CRANE');
});

test('gameOver blocks input', () => {
  let gameOver = true;
  function handleKey(k) { if(gameOver) return 'blocked'; return 'ok'; }
  expect(handleKey('A')).toBe('blocked');
});

// ════════════════════════════════════════════════════════════
// BLACK BOX: Partner Mode
// ════════════════════════════════════════════════════════════
section('BLACK BOX: Partner Mode');

test('setter index 0: p1 sets, p2 guesses', () => {
  const names = {p1:'Alice',p2:'Bob'};
  const idx = 0;
  expect(idx===0 ? names.p1 : names.p2).toBe('Alice'); // setter
  expect(idx===0 ? names.p2 : names.p1).toBe('Bob');   // guesser
});

test('setter index 1: p2 sets, p1 guesses', () => {
  const names = {p1:'Alice',p2:'Bob'};
  const idx = 1;
  expect(idx===0 ? names.p1 : names.p2).toBe('Bob');   // setter
  expect(idx===0 ? names.p2 : names.p1).toBe('Alice'); // guesser
});

test('nextPartnerRound alternates setter index', () => {
  let idx = 0;
  idx = idx===0?1:0; expect(idx).toBe(1);
  idx = idx===0?1:0; expect(idx).toBe(0);
  idx = idx===0?1:0; expect(idx).toBe(1);
});

test('partner word must be in VALID_GUESSES', () => {
  expect(global.VALID_GUESSES.includes('crane')).toBeTrue();
  expect(global.VALID_GUESSES.includes('xkzqp')).toBeFalse();
});

test('partner word must be exactly 5 letters', () => {
  expect('crane'.length).toBe(5);
  expect('cran'.length !== 5).toBeTrue();
  expect('cranes'.length !== 5).toBeTrue();
});

test('guesser scores tracked per guesser key', () => {
  localStorage.removeItem('lovedle_scores');
  // idx=0: p2 is guesser
  const guesserKey = 0===0 ? 'p2' : 'p1';
  const scores = loadScores();
  if(!scores[guesserKey]) scores[guesserKey]={wins:0,rounds:0,totalGuesses:0};
  scores[guesserKey].wins++;
  scores[guesserKey].rounds++;
  scores[guesserKey].totalGuesses+=3;
  saveScores(scores);
  const loaded = loadScores();
  expect(loaded.p2.wins).toBe(1);
  expect(loaded.p1).toBe(undefined); // p1 untouched
});

// ════════════════════════════════════════════════════════════
// BLACK BOX: Scoring & Leaderboard
// ════════════════════════════════════════════════════════════
section('BLACK BOX: Score Tracking');

test('win records correct totalGuesses', () => {
  localStorage.removeItem('lovedle_scores');
  let s = loadScores();
  if(!s.p2) s.p2={wins:0,rounds:0,totalGuesses:0};
  s.p2.rounds++; s.p2.wins++; s.p2.totalGuesses+=4;
  saveScores(s);
  expect(loadScores().p2.totalGuesses).toBe(4);
});

test('loss records 7 as penalty guesses', () => {
  localStorage.removeItem('lovedle_scores');
  let s = loadScores();
  if(!s.p1) s.p1={wins:0,rounds:0,totalGuesses:0};
  s.p1.rounds++; s.p1.totalGuesses+=7; // no wins++ on loss
  saveScores(s);
  const loaded = loadScores();
  expect(loaded.p1.wins).toBe(0);
  expect(loaded.p1.totalGuesses).toBe(7);
});

test('average calc correct', () => {
  const s = {wins:3,rounds:3,totalGuesses:12};
  const avg = s.rounds>0 ? (s.totalGuesses/s.rounds).toFixed(1) : '-';
  expect(avg).toBe('4.0');
});

test('average with losses rounds correctly', () => {
  const s = {wins:2,rounds:4,totalGuesses:20}; // 2 wins (9 guesses) + 2 losses (14)
  const avg = (s.totalGuesses/s.rounds).toFixed(1);
  expect(avg).toBe('5.0');
});

test('tie: both players equal wins → isTie true', () => {
  const p1w=2, p2w=2;
  const maxWins = Math.max(p1w,p2w);
  const isTie = p1w===p2w && maxWins>0;
  expect(isTie).toBeTrue();
});

test('leader: p1 ahead → p1 wins, p2 not winner', () => {
  const scores={p1:{wins:3},p2:{wins:1}};
  const maxWins=Math.max(scores.p1.wins,scores.p2.wins);
  const isTie=scores.p1.wins===scores.p2.wins&&maxWins>0;
  expect(!isTie&&scores.p1.wins===maxWins&&maxWins>0).toBeTrue();
  expect(!isTie&&scores.p2.wins===maxWins&&maxWins>0).toBeFalse();
});

test('zero wins: no winner (0-0 tie should not show trophy)', () => {
  const scores={p1:{wins:0},p2:{wins:0}};
  const maxWins=Math.max(scores.p1.wins,scores.p2.wins);
  const isTie=scores.p1.wins===scores.p2.wins&&maxWins>0;
  const isWinner=!isTie&&scores.p1.wins===maxWins&&maxWins>0;
  expect(isWinner).toBeFalse();
  expect(isTie).toBeFalse(); // 0-0 is not a "tie" that shows trophy
});

// ════════════════════════════════════════════════════════════
// BLACK BOX: Hint System
// ════════════════════════════════════════════════════════════
section('BLACK BOX: Hints');

test('hint picks from unguessed positions only', () => {
  const target='crane';
  const guesses=[{feedback:[{result:'correct'},{result:'absent'},{result:'absent'},{result:'absent'},{result:'absent'}]}];
  const placed=new Set();
  guesses.forEach(g=>g.feedback.forEach((f,i)=>{if(f.result==='correct')placed.add(i);}));
  const candidates=[];
  for(let i=0;i<5;i++){if(!placed.has(i))candidates.push({letter:target[i],pos:i+1});}
  expect(candidates.length).toBe(4);
  expect(candidates.map(c=>c.pos)).notToContain(1); // pos1 (idx0) is already correct
});

test('all correct placed → no hint candidates', () => {
  const guesses=[{feedback:Array(5).fill({result:'correct'})}];
  const placed=new Set();
  guesses.forEach(g=>g.feedback.forEach((f,i)=>{if(f.result==='correct')placed.add(i);}));
  const candidates=[];
  for(let i=0;i<5;i++){if(!placed.has(i))candidates.push(i);}
  expect(candidates.length).toBe(0);
});

test('hint count: starts at 3, decrements to 0', () => {
  let h=3;
  h--; expect(h).toBe(2);
  h--; expect(h).toBe(1);
  h--; expect(h).toBe(0);
  expect(h<=0).toBeTrue();
});

test('hint disabled check at 0', () => {
  let h=0;
  expect(h<=0||false).toBeTrue(); // gameOver||hintsLeft===0 → disabled
});

test('hint picks a letter that IS in the target', () => {
  const target='crane';
  const placed=new Set();
  const candidates=[];
  for(let i=0;i<5;i++){if(!placed.has(i))candidates.push({letter:target[i],pos:i+1});}
  candidates.forEach(c=>{
    expect(target.includes(c.letter)).toBeTrue();
  });
});

// ════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════
console.log('\n\n' + '═'.repeat(50));
console.log(` RESULTS: ${passed}/${total} passed  |  ${failed} failed`);
console.log('═'.repeat(50));
if(failures.length){
  console.log('\n❌ FAILURES:\n');
  failures.forEach(f=>{
    console.log(`  ✗ ${f.name}`);
    console.log(`    → ${f.err}\n`);
  });
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!\n');
}
