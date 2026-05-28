// Vercel Serverless Function — proxy para Anthropic API
// Rota: POST /api/claude (mapeado automaticamente pelo diretório api/)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(204).set(corsHeaders).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).set(corsHeaders).json({ error: 'Method Not Allowed' });
    return;
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    res.status(500).set(corsHeaders).json({ error: 'ANTHROPIC_API_KEY não configurado' });
    return;
  }

  const body = req.body;
  if (!body || typeof body !== 'object') {
    res.status(400).set(corsHeaders).json({ error: 'Body inválido' });
    return;
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  const data = await upstream.text();
  res.status(upstream.status).set({ ...corsHeaders, 'Content-Type': 'application/json' }).end(data);
}
