const KB_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','&#x232B;']
];

// ── Persistence ───────────────────────────────────────────────
function loadNames() {
  try { return JSON.parse(localStorage.getItem('lovedle_names')) || {p1:'Player 1',p2:'Player 2'}; } catch(e){ return {p1:'Player 1',p2:'Player 2'}; }
}
function saveNamesToStorage(p1,p2) {
  localStorage.setItem('lovedle_names', JSON.stringify({p1:p1||'Player 1',p2:p2||'Player 2'}));
}
function loadScores() {
  try { return JSON.parse(localStorage.getItem('lovedle_scores')) || {}; } catch(e){ return {}; }
}
function saveScores(s) {
  localStorage.setItem('lovedle_scores', JSON.stringify(s));
}

// ── State ─────────────────────────────────────────────────────
let names = loadNames();
let target = '';
let guesses = [];
let currentRow = 0;
let currentInput = '';
let gameOver = false;
let isPartnerMode = false;
let partnerWord = '';
let inputLocked = false;
let hintsLeft = 3;
let partnerSetterIdx = 0; // 0 = p1 sets, p2 guesses; 1 = p2 sets, p1 guesses
let shareData = '';

// ── Screen Navigation ─────────────────────────────────────────
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function goHome() {
  updateHomeTally();
  show('home');
}

function goToNames() {
  document.getElementById('name1-input').value = names.p1 === 'Player 1' ? '' : names.p1;
  document.getElementById('name2-input').value = names.p2 === 'Player 2' ? '' : names.p2;
  show('names-screen');
}

function saveNames(skip) {
  if (!skip) {
    const p1 = document.getElementById('name1-input').value.trim() || 'Player 1';
    const p2 = document.getElementById('name2-input').value.trim() || 'Player 2';
    names = {p1, p2};
    saveNamesToStorage(p1, p2);
  }
  updateNamesDisplay();
  updateHomeTally();
  show('home');
}

function updateNamesDisplay() {
  const el = document.getElementById('names-display');
  if (names.p1 === 'Player 1' && names.p2 === 'Player 2') {
    el.innerHTML = '&#x270F;&#xFE0F; Set your names';
    el.style.color = '#666';
  } else {
    el.innerHTML = '&#x1F495; ' + names.p1 + ' &amp; ' + names.p2 + ' &#x270F;&#xFE0F;';
    el.style.color = '#f9a8d4';
  }
}

function updateHomeTally() {
  const scores = loadScores();
  const p1k = 'p1', p2k = 'p2';
  const p1 = scores[p1k], p2 = scores[p2k];
  if (!p1 && !p2) { document.getElementById('home-tally').style.display = 'none'; return; }
  document.getElementById('home-tally').style.display = 'block';
  const rows = document.getElementById('tally-rows');
  rows.innerHTML = '';
  [[p1k, names.p1, p1],[p2k, names.p2, p2]].forEach(([key, name, s]) => {
    if (!s) return;
    const div = document.createElement('div');
    div.className = 'tally-row';
    const avg = s.rounds > 0 ? (s.totalGuesses / s.rounds).toFixed(1) : '-';
    const esc=t=>t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); div.innerHTML = `<span class="tally-name">${esc(name)}</span><span class="tally-stats">${s.rounds} rounds &bull; avg ${avg}</span><span class="tally-wins">${s.wins}W</span>`;
    rows.appendChild(div);
  });
}

function confirmHome() {
  if (!gameOver && guesses.length > 0) {
    if (!confirm('Leave this game? Progress will be lost.')) return;
  }
  goHome();
}

// ── Solo / Partner Start ──────────────────────────────────────
function startSolo() {
  isPartnerMode = false;
  target = WORDS[Math.floor(Math.random() * WORDS.length)].toLowerCase();
  initGame();
  show('game');
}

function showPartnerEntry() {
  const setterName = partnerSetterIdx === 0 ? names.p1 : names.p2;
  const guesserName = partnerSetterIdx === 0 ? names.p2 : names.p1;
  document.getElementById('entry-sub').textContent = setterName + ': type a 5-letter word for ' + guesserName + ' to guess';
  document.getElementById('word-input').value = '';
  document.getElementById('entry-error').textContent = '';
  show('partner-entry');
  setTimeout(() => document.getElementById('word-input').focus(), 100);
}

function setPartnerWord() {
  const w = document.getElementById('word-input').value.toLowerCase().replace(/[^a-z]/g,'');
  if (w.length !== 5) { document.getElementById('entry-error').textContent = 'Must be exactly 5 letters!'; return; }
  if (!WORDS.includes(w) && !VALID_GUESSES.includes(w)) { document.getElementById('entry-error').textContent = 'Not a valid Wordle word — try another!'; return; }
  partnerWord = w;
  const guesserName = partnerSetterIdx === 0 ? names.p2 : names.p1;
  document.getElementById('pass-title').innerHTML = 'Pass to ' + guesserName + '! &#x1F495;';
  document.getElementById('pass-sub').textContent = guesserName + ', close your eyes while the screen is handed over \uD83D\uDE09';
  show('pass-screen');
}

function startPartnerGame() {
  isPartnerMode = true;
  target = partnerWord;
  initGame();
  show('game');
}

function playAgain() {
  if (isPartnerMode) {
    showPartnerEntry();
  } else {
    target = WORDS[Math.floor(Math.random() * WORDS.length)].toLowerCase();
    initGame();
  }
}

function nextPartnerRound() {
  partnerSetterIdx = partnerSetterIdx === 0 ? 1 : 0;
  showPartnerEntry();
}

// ── Board Init ────────────────────────────────────────────────
function initGame() {
  guesses = [];
  currentRow = 0;
  currentInput = '';
  gameOver = false;
  inputLocked = false;
  hintsLeft = 3;
  shareData = '';
  document.getElementById('hint-btn').disabled = false;
  document.getElementById('hint-count').textContent = '3';
  document.getElementById('result-msg').innerHTML = '';
  document.getElementById('result-word').textContent = '';
  document.getElementById('result-actions').style.display = 'none';
  const board = document.getElementById('board');
  board.innerHTML = '';
  for (let r = 0; r < 6; r++) {
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:5px;';
    row.id = 'row-' + r;
    for (let c = 0; c < 5; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.id = `tile-${r}-${c}`;
      row.appendChild(tile);
    }
    board.appendChild(row);
  }
  buildKeyboard();
}

// ── Keyboard ──────────────────────────────────────────────────
function buildKeyboard() {
  KB_ROWS.forEach((row, ri) => {
    const el = document.getElementById('kb-row-' + ri);
    el.innerHTML = '';
    row.forEach(k => {
      const btn = document.createElement('button');
      btn.className = 'key' + (k === 'ENTER' || k === '&#x232B;' ? ' wide' : '');
      btn.innerHTML = k;
      btn.dataset.key = k;
      btn.addEventListener('click', () => { btn.blur(); handleKey(k === '&#x232B;' ? 'BACKSPACE' : k); });
      el.appendChild(btn);
    });
  });
}

function updateKeyColors(feedback) {
  const priority = {correct:3,present:2,absent:1};
  feedback.forEach(({letter, result}) => {
    document.querySelectorAll('.key').forEach(k => {
      if (k.dataset.key === letter.toUpperCase()) {
        const cur = k.classList.contains('correct')?3:k.classList.contains('present')?2:k.classList.contains('absent')?1:0;
        if ((priority[result]||0) > cur) {
          k.classList.remove('correct','present','absent');
          k.classList.add(result);
        }
      }
    });
  });
}

// ── Input ─────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (!document.getElementById('game').classList.contains('active')) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.target && e.target.classList && e.target.classList.contains('key')) { e.preventDefault(); return; }
  if (e.key === 'Enter') handleKey('ENTER');
  else if (e.key === 'Backspace') handleKey('BACKSPACE');
  else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
});

function handleKey(key) {
  if (gameOver || inputLocked) return;
  if (key === 'BACKSPACE') {
    if (currentInput.length > 0) { currentInput = currentInput.slice(0,-1); updateCurrentRow(); }
  } else if (key === 'ENTER') {
    submitGuess();
  } else if (currentInput.length < 5 && /^[A-Z]$/.test(key)) {
    currentInput += key;
    updateCurrentRow();
  }
}

function updateCurrentRow() {
  for (let c = 0; c < 5; c++) {
    const tile = document.getElementById(`tile-${currentRow}-${c}`);
    const letter = currentInput[c] || '';
    tile.textContent = letter;
    letter ? tile.classList.add('filled') : tile.classList.remove('filled');
  }
}

// ── Submit ────────────────────────────────────────────────────
function submitGuess() {
  if (currentInput.length < 5) { showToast('Not enough letters'); shakeRow(currentRow); return; }
  const w = currentInput.toLowerCase();
  if (!VALID_GUESSES.includes(w)) { showToast('Not a word!'); shakeRow(currentRow); return; }
  const feedback = computeFeedback(w, target);
  guesses.push({word:w, feedback});
  flipRow(currentRow, feedback);
  const row = currentRow;
  currentRow++;
  currentInput = '';
  inputLocked = true;
  setTimeout(() => { inputLocked = false; }, 400);

  const emojiMap = {correct:String.fromCodePoint(0x1F7E9),present:String.fromCodePoint(0x1F7E8),absent:String.fromCodePoint(0x2B1B)};
  shareData += feedback.map(f => emojiMap[f.result]).join('') + '\n';

  const won = feedback.every(f => f.result === 'correct');
  setTimeout(() => {
    updateKeyColors(feedback);
    if (won) {
      gameOver = true;
      const guesserName = isPartnerMode ? (partnerSetterIdx === 0 ? names.p2 : names.p1) : null;
      const msgs = ['Genius!','Magnificent!','Impressive!','Splendid!','Great!','Phew!'];
      const base = msgs[Math.min(row, 5)];
      if (isPartnerMode) {
        document.getElementById('result-msg').innerHTML = guesserName + ' got it in ' + (row+1) + '! ' + base + ' &#x1F3C6;';
      } else {
        document.getElementById('result-msg').innerHTML = '&#x1F389; ' + base + ' You got it in ' + (row+1) + '!';
      }
      document.getElementById('result-actions').style.display = 'flex';
      document.getElementById('hint-btn').disabled = true;
      launchHearts();
      if (isPartnerMode) recordPartnerResult(row+1, true);
    } else if (currentRow >= 6) {
      gameOver = true;
      document.getElementById('result-msg').innerHTML = 'The word was:';
      document.getElementById('result-word').textContent = target.toUpperCase();
      document.getElementById('result-actions').style.display = 'flex';
      document.getElementById('hint-btn').disabled = true;
      if (isPartnerMode) recordPartnerResult(null, false);
    }
  }, 5 * 350 + 200);
}

function computeFeedback(guess, target) {
  const g = guess.split(''), t = target.split('');
  const res = Array(5).fill('absent');
  const tUsed = Array(5).fill(false), gUsed = Array(5).fill(false);
  for(let i=0;i<5;i++) if(g[i]===t[i]){res[i]='correct';tUsed[i]=gUsed[i]=true;}
  for(let i=0;i<5;i++){if(gUsed[i])continue;for(let j=0;j<5;j++){if(tUsed[j])continue;if(g[i]===t[j]){res[i]='present';tUsed[j]=true;break;}}}
  return g.map((letter,i)=>({letter,result:res[i]}));
}

// ── Hint ──────────────────────────────────────────────────────
function useHint() {
  if (hintsLeft <= 0 || gameOver) return;
  // Find letters in target not yet correctly placed
  const correctlyPlaced = new Set();
  guesses.forEach(g => g.feedback.forEach((f,i) => { if(f.result==='correct') correctlyPlaced.add(i); }));
  const candidates = [];
  for(let i=0;i<5;i++) { if(!correctlyPlaced.has(i)) candidates.push({letter:target[i],pos:i+1}); }
  if (candidates.length === 0) { showToast('No more hints available!'); return; }
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  hintsLeft--;
  document.getElementById('hint-count').textContent = hintsLeft;
  if (hintsLeft === 0) document.getElementById('hint-btn').disabled = true;
  showToast('&#x1F4A1; Position ' + pick.pos + ' is the letter ' + pick.letter.toUpperCase(), 2500);
}

// ── Partner Scoring ───────────────────────────────────────────
function recordPartnerResult(guessCount, won) {
  const guesserKey = partnerSetterIdx === 0 ? 'p2' : 'p1';
  const guesserName = partnerSetterIdx === 0 ? names.p2 : names.p1;
  const scores = loadScores();
  if (!scores[guesserKey]) scores[guesserKey] = {wins:0,rounds:0,totalGuesses:0};
  scores[guesserKey].rounds++;
  if (won) { scores[guesserKey].wins++; scores[guesserKey].totalGuesses += guessCount; }
  else { scores[guesserKey].totalGuesses += 7; } // count loss as 7
  saveScores(scores);
  setTimeout(() => showRoundResult(guesserName, setterName, guessCount, won, scores), 1200);
}

function showRoundResult(guesserName, setterName, guessCount, won, scores) {
  const p1k = 'p1', p2k = 'p2';
  document.getElementById('rr-title').innerHTML = won ? guesserName + ' got it! &#x1F3C6;' : 'Better luck next time!';
  document.getElementById('rr-subtitle').textContent = won ? 'Solved in ' + guessCount + ' guess' + (guessCount===1?'':'es') + '!' : 'The word was: ' + target.toUpperCase();
  const playersDiv = document.getElementById('rr-players');
  const p1Data = scores[p1k], p2Data = scores[p2k];
  playersDiv.innerHTML = '';
  [[p1k, names.p1, p1Data],[p2k, names.p2, p2Data]].forEach(([key, name, s]) => {
    if (!s) return;
    const div = document.createElement('div');
    const maxWins = Math.max((scores[p1k]||{wins:0}).wins, (scores[p2k]||{wins:0}).wins); const isTie = (scores[p1k]||{wins:0}).wins === (scores[p2k]||{wins:0}).wins && maxWins > 0; const isWinner = !isTie && s.wins === maxWins && s.wins > 0;
    div.className = 'rr-player' + (isWinner ? ' winner' : '');
    const avg = s.rounds > 0 ? (s.totalGuesses / s.rounds).toFixed(1) : '-';
    div.innerHTML = `<div class="rr-player-name">${name}</div><div class="rr-player-guesses">${s.wins}</div><div class="rr-player-label">${s.rounds} rounds &bull; avg ${avg}</div>`;
    playersDiv.appendChild(div);
  });
  const tallyDiv = document.getElementById('tally-detail');
  tallyDiv.innerHTML = '';
  [[p1k, names.p1, p1Data],[p2k, names.p2, p2Data]].forEach(([key, name, s]) => {
    if (!s) return;
    const div = document.createElement('div');
    div.className = 'st-row';
    div.innerHTML = `<span class="st-name">${name}</span><span class="st-info">${s.rounds} rounds</span><span class="st-wins">${s.wins}W</span>`;
    tallyDiv.appendChild(div);
  });
  show('round-result');
}

// ── Animations ────────────────────────────────────────────────
function flipRow(row, feedback) {
  for(let c=0;c<5;c++){
    const tile = document.getElementById(`tile-${row}-${c}`);
    const result = feedback[c].result;
    setTimeout(() => {
      tile.style.transition = 'transform 0.25s ease';
      tile.style.transform = 'rotateX(-90deg)';
      setTimeout(() => {
        tile.classList.add(result);
        tile.style.transform = ''; tile.style.transition = '';
      }, 250);
    }, c * 350);
  }
}

function shakeRow(row) {
  for(let c=0;c<5;c++){
    const tile = document.getElementById(`tile-${row}-${c}`);
    tile.classList.add('shake');
    tile.addEventListener('animationend', () => tile.classList.remove('shake'), {once:true});
  }
}

// ── Toast ─────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, ms) {
  const t = document.getElementById('toast');
  t.innerHTML = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms || 1500);
}

// ── Heart Confetti ────────────────────────────────────────────
function launchHearts() {
  const hearts = ['&#x1F495;','&#x2764;','&#x1F493;','&#x1F497;','&#x1F498;','&#x1F496;'];
  for(let i=0;i<30;i++){
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'heart-particle';
      el.innerHTML = hearts[Math.floor(Math.random()*hearts.length)];
      el.style.cssText = `left:${Math.random()*100}vw;bottom:-40px;font-size:${.9+Math.random()*1.4}rem;animation-duration:${2+Math.random()*1.5}s`;
      document.body.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    }, i*80);
  }
}

// ── Share ─────────────────────────────────────────────────────
function shareResult() {
  const guessCount = gameOver && guesses[guesses.length-1].feedback.every(f=>f.result==='correct') ? guesses.length : 'X';
  const text = 'Lovedle \u2665 ' + guessCount + '/6\n\n' + shareData;
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!')).catch(() => showToast('Could not copy'));
}

// ── Init ──────────────────────────────────────────────────────
names = loadNames();
const firstRun = !localStorage.getItem('lovedle_names');
if (firstRun) {
  show('names-screen');
} else {
  updateNamesDisplay();
  updateHomeTally();
  show('home');
}
