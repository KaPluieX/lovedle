// Lovedle Game Logger — Cloudflare Worker
// POST /log  — record a game
// GET  /logs — view all logs (requires ?key=<LOG_VIEW_KEY>)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    // ── POST /log ──────────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/log') {
      let body;
      try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400, headers: CORS }); }

      const ip = request.headers.get('CF-Connecting-IP') ||
                 request.headers.get('X-Forwarded-For') ||
                 'unknown';
      const country = request.headers.get('CF-IPCountry') || 'unknown';

      const entry = {
        timestamp: new Date().toISOString(),
        ip,
        country,
        mode: body.mode || 'solo',           // 'solo' | 'partner'
        word: body.word || '',
        won: body.won ?? null,
        guesses: body.guesses ?? null,
        player1: body.player1 || null,
        player2: body.player2 || null,
        guesser: body.guesser || null,        // who guessed in partner mode
      };

      // Key: timestamp-based so they sort naturally
      const key = 'game:' + Date.now() + ':' + Math.random().toString(36).slice(2,6);
      await env.LOVEDLE_LOGS.put(key, JSON.stringify(entry));

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // ── GET /logs ──────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/logs') {
      const key = url.searchParams.get('key');
      if (!key || key !== env.LOG_VIEW_KEY) {
        return new Response('Unauthorized', { status: 401, headers: CORS });
      }

      const limit = Math.min(parseInt(url.searchParams.get('limit') || '200'), 500);
      const list = await env.LOVEDLE_LOGS.list({ prefix: 'game:', limit });
      const entries = await Promise.all(
        list.keys.reverse().map(async k => {
          const val = await env.LOVEDLE_LOGS.get(k.name);
          try { return JSON.parse(val); } catch { return null; }
        })
      );

      return new Response(JSON.stringify(entries.filter(Boolean), null, 2), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404, headers: CORS });
  }
};
