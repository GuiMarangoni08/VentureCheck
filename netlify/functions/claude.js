// Proxy para Anthropic API — evita expor a chave no frontend
// Rota: POST /api/claude

export default async (req, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const API_KEY = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurado' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.text();
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body,
  });

  const data = await upstream.text();
  return new Response(data, {
    status: upstream.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/claude' };
