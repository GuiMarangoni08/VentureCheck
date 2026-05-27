// Proxy para Anthropic API com streaming SSE — evita timeout 504
// Rota: POST /api/claude (via redirect no netlify.toml)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurado' }),
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Body inválido' }),
    };
  }

  // Faz a chamada sem streaming e retorna tudo de uma vez
  // Timeout de 26s configurado no netlify.toml
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(parsed),
  });

  const data = await upstream.text();
  return {
    statusCode: upstream.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: data,
  };
};
