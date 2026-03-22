// Lovedle Worker — Game Logging + Online Multiplayer Rooms
// POST /log                 — record solo/partner game
// GET  /logs?key=...        — view logs (auth required)
// POST /room                — create online room
// GET  /room/:code          — get room state
// POST /room/:code/join     — player 2 joins
// POST /room/:code/guess    — submit a guess

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// 200 common 5-letter words for online games
const ONLINE_WORDS = [
  'about','above','abuse','actor','admit','adopt','after','again','agree','ahead',
  'alarm','album','alert','alike','align','allow','alone','alter','angel','anger',
  'angle','annex','apart','apple','apply','arena','arise','armor','arrow','aside',
  'award','aware','bacon','badly','baker','basis','beach','beard','beast','begin',
  'below','bench','berry','black','blade','blame','bland','blast','blend','bless',
  'blind','block','blood','blunt','board','bonus','boost','bound','brace','brain',
  'brand','brave','bread','break','breed','brick','bride','bring','broad','brown',
  'brush','build','burst','buyer','candy','cargo','carry','catch','cause','chain',
  'chair','chalk','chaos','charm','chart','chase','cheap','check','chest','chief',
  'child','chill','claim','class','clean','clear','click','cliff','climb','clock',
  'close','cloud','coast','color','count','cover','craft','crane','crash','crazy',
  'cream','crisp','cross','crowd','crown','crust','curse','curve','cycle','daily',
  'dance','depth','devil','digit','dodge','dough','draft','drain','drama','drawn',
  'dream','dress','drive','drown','eagle','early','earth','eight','elite','empty',
  'enemy','enjoy','enter','equal','error','essay','event','every','exact','extra',
  'faith','fancy','feast','fever','flame','flash','fleet','float','floor','flush',
  'focus','forge','found','frame','fresh','front','frost','fruit','funny','ghost',
  'given','glass','gloom','glory','glove','grace','grade','grain','grand','grant',
  'grasp','grass','grave','great','greed','grief','grill','grind','groan','grove',
  'grown','guard','guilt','habit','happy','harsh','haven','heart','heavy','hedge',
  'hippo','hobby','honor','horse','hotel','house','human','humor','hurry','image',
  'inner','ivory','jewel','juice','karma','knife','knock','known','label','large',
  'laser','later','laugh','layer','lemon','level','light','limit','local','lover',
  'lucky','lunar','lyric','magic','major','maker','manor','maple','march','match',
  'mayor','melon','mercy','merit','metal','minor','model','money','month','moral',
  'mouse','mouth','mural','music','naive','naval','nerve','noble','noise','north',
  'noted','novel','nurse','ocean','offer','often','olive','onset','orbit','order',
  'paint','panel','panic','paper','party','paste','patch','pause','peace','pearl',
  'penny','perch','phase','phone','photo','piano','piece','pilot','pitch','pixel',
  'pizza','place','plain','plane','plant','plate','plead','pluck','point','power',
  'press','price','pride','print','prior','prize','proof','prose','proud','prove',
  'pulse','punch','purse','queen','quest','quick','quiet','quite','quota','quote',
  'radio','raise','rally','ranch','range','rapid','ratio','reach','realm','rebel',
  'regal','reign','relax','rider','ridge','rifle','right','risky','rival','river',
  'robot','rocky','rough','round','route','royal','ruler','sadly','saint','salad',
  'sauce','scale','scare','scene','scope','score','scout','seize','sense','serve',
  'seven','shade','shaft','shape','share','shark','sharp','shelf','shell','shift',
  'shirt','shock','shoot','shore','short','shout','sight','silly','skill','slate',
  'sleep','slice','slide','slope','smart','smash','smell','smile','smoke','snake',
  'solar','solid','solve','sorry','south','space','spark','speak','spend','spice',
  'spine','split','sport','spray','stack','staff','stage','stain','stair','stand',
  'stark','start','state','steam','steel','stern','still','stock','stone','store',
  'storm','story','stout','straw','strip','stuck','study','style','sugar','sunny',
  'surge','swamp','swear','sweet','swift','swing','sword','table','taste','tense',
  'theme','thick','thing','think','thorn','three','throw','tiger','tight','timer',
  'tired','titan','title','today','token','topic','total','touch','tough','towel',
  'tower','toxic','trace','track','trade','trail','train','trait','trash','treat',
  'trend','trial','tribe','truly','trunk','trust','truth','twice','twist','ultra',
  'under','union','unite','until','upper','upset','urban','usage','usual','valid',
  'valor','value','vapor','vault','venue','verse','video','vigor','viral','virus',
  'visit','vital','vivid','vocal','voice','voter','waste','watch','water','weary',
  'weird','whale','wheat','wheel','white','whole','witty','woman','world','worry',
  'worse','worst','worth','would','wound','wrath','write','young','youth','zebra'
];

function generateCode() {
  const c = 'ABCDEFGHJKMNPRSTUVWXY';
  return Array.from({length:5}, () => c[Math.floor(Math.random()*c.length)]).join('');
}

function computeFeedback(guess, target) {
  const g = guess.split(''), t = target.split('');
  const res = Array(5).fill('absent');
  const tUsed = Array(5).fill(false), gUsed = Array(5).fill(false);
  for(let i=0;i<5;i++) if(g[i]===t[i]){res[i]='correct';tUsed[i]=gUsed[i]=true;}
  for(let i=0;i<5;i++){
    if(gUsed[i]) continue;
    for(let j=0;j<5;j++){
      if(tUsed[j]) continue;
      if(g[i]===t[j]){res[i]='present';tUsed[j]=true;break;}
    }
  }
  return res;
}

function safeJson(r, data, status=200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status:204, headers:CORS });

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // ── POST /log ─────────────────────────────────────────────
    if (method === 'POST' && path === '/log') {
      let body;
      try { body = await request.json(); } catch { return new Response('Bad JSON', {status:400,headers:CORS}); }
      const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
      const entry = {
        timestamp: new Date().toISOString(),
        ip,
        country: request.headers.get('CF-IPCountry') || 'unknown',
        mode: body.mode || 'solo',
        word: body.word || '',
        won: body.won ?? null,
        guesses: body.guesses ?? null,
        player1: body.player1 || null,
        player2: body.player2 || null,
        guesser: body.guesser || null,
      };
      const key = 'game:' + Date.now() + ':' + Math.random().toString(36).slice(2,6);
      await env.LOVEDLE_LOGS.put(key, JSON.stringify(entry), { expirationTtl: 60*60*24*90 });
      return safeJson(request, { ok: true });
    }

    // ── GET /logs ─────────────────────────────────────────────
    if (method === 'GET' && path === '/logs') {
      if (url.searchParams.get('key') !== env.LOG_VIEW_KEY) return new Response('Unauthorized', {status:401,headers:CORS});
      const limit = Math.min(parseInt(url.searchParams.get('limit')||'200'), 500);
      const list = await env.LOVEDLE_LOGS.list({ prefix:'game:', limit });
      const entries = await Promise.all(list.keys.reverse().map(async k => {
        try { return JSON.parse(await env.LOVEDLE_LOGS.get(k.name)); } catch { return null; }
      }));
      return safeJson(request, entries.filter(Boolean));
    }

    // ── POST /room — create room ──────────────────────────────
    if (method === 'POST' && path === '/room') {
      let body;
      try { body = await request.json(); } catch { return new Response('Bad JSON',{status:400,headers:CORS}); }
      const word = ONLINE_WORDS[Math.floor(Math.random()*ONLINE_WORDS.length)];
      const code = generateCode();
      const room = {
        word,
        createdAt: Date.now(),
        status: 'waiting',
        players: {
          '1': { name: body.name || 'Player 1', guesses: [], done: false, won: false },
          '2': null
        }
      };
      await env.LOVEDLE_LOGS.put('room:'+code, JSON.stringify(room), { expirationTtl: 60*60*2 });
      return safeJson(request, { code, slot: 1, word });
    }

    // ── Room routes (/room/:code/*) ───────────────────────────
    const roomMatch = path.match(/^\/room\/([A-Z0-9]{4,6})(\/.*)?$/);
    if (roomMatch) {
      const code = roomMatch[1];
      const sub = roomMatch[2] || '/';
      const roomKey = 'room:' + code;
      const raw = await env.LOVEDLE_LOGS.get(roomKey);
      if (!raw) return safeJson(request, { error: 'Room not found' }, 404);
      const room = JSON.parse(raw);

      // GET /room/:code — state (no word until done)
      if (method === 'GET' && sub === '/') {
        const pub = {
          status: room.status,
          players: {
            '1': room.players['1'] ? {
              name: room.players['1'].name,
              guessCount: room.players['1'].guesses.length,
              board: room.players['1'].guesses.map(g => g.feedback),
              done: room.players['1'].done,
              won: room.players['1'].won
            } : null,
            '2': room.players['2'] ? {
              name: room.players['2'].name,
              guessCount: room.players['2'].guesses.length,
              board: room.players['2'].guesses.map(g => g.feedback),
              done: room.players['2'].done,
              won: room.players['2'].won
            } : null,
          },
          word: room.status === 'done' ? room.word : undefined
        };
        return safeJson(request, pub);
      }

      // POST /room/:code/join
      if (method === 'POST' && sub === '/join') {
        if (room.players['2']) return safeJson(request, { error: 'Room is full' }, 409);
        let body;
        try { body = await request.json(); } catch { body = {}; }
        room.players['2'] = { name: body.name || 'Player 2', guesses: [], done: false, won: false };
        room.status = 'playing';
        await env.LOVEDLE_LOGS.put(roomKey, JSON.stringify(room), { expirationTtl: 60*60*2 });
        return safeJson(request, { ok: true, slot: 2, word: room.word });
      }

      // POST /room/:code/guess
      if (method === 'POST' && sub === '/guess') {
        let body;
        try { body = await request.json(); } catch { return new Response('Bad JSON',{status:400,headers:CORS}); }
        const slot = String(body.slot);
        const guess = (body.guess || '').toLowerCase().trim();
        if (!['1','2'].includes(slot)) return safeJson(request, { error:'Invalid slot'}, 400);
        if (!room.players[slot]) return safeJson(request, { error:'Player not in room'}, 400);
        if (room.players[slot].done) return safeJson(request, { error:'Already done'}, 400);
        if (guess.length !== 5) return safeJson(request, { error:'Must be 5 letters'}, 400);
        const feedback = computeFeedback(guess, room.word);
        const won = feedback.every(r => r === 'correct');
        room.players[slot].guesses.push({ word: guess, feedback });
        if (won || room.players[slot].guesses.length >= 6) {
          room.players[slot].done = true;
          room.players[slot].won = won;
        }
        // Check if both done
        const p1done = !room.players['1'] || room.players['1'].done;
        const p2done = !room.players['2'] || room.players['2'].done;
        if (p1done && p2done) room.status = 'done';
        await env.LOVEDLE_LOGS.put(roomKey, JSON.stringify(room), { expirationTtl: 60*60*2 });
        return safeJson(request, {
          feedback,
          won,
          done: room.players[slot].done,
          guessCount: room.players[slot].guesses.length,
          roomStatus: room.status,
          word: room.status === 'done' ? room.word : undefined
        });
      }
    }

    return new Response('Not found', { status:404, headers:CORS });
  }
};
