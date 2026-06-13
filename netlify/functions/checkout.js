// Cria preferência de pagamento — Mercado Pago (principal) ou Stripe (alternativo)
// Provider selecionado via variável de ambiente PAYMENT_PROVIDER (mp | stripe)

const PLANS = {
  validacao:    { title: 'VentureCheck — Validação',      price: 149,  description: 'IMI · Clareza da ideia · Veredito · Próximos passos' },
  diagnostico:  { title: 'VentureCheck — Diagnóstico',    price: 497,  description: 'Análise completa · 7 blocos · Financeiro · Roadmap' },
  business_plan:{ title: 'VentureCheck — Business Plan',  price: 997,  description: 'Projeções · Plano operacional · Modelo financeiro' },
  venture:      { title: 'VentureCheck — Venture',        price: 1697, description: 'Valuation · Data room · Pitch deck · Estratégia captação' },
};

async function createMercadoPago(plan, sessionId, origin) {
  const MP_TOKEN = Netlify.env.get('MP_ACCESS_TOKEN');
  if (!MP_TOKEN) throw new Error('MP_ACCESS_TOKEN não configurado');

  const body = {
    items: [{
      id: plan,
      title: PLANS[plan].title,
      description: PLANS[plan].description,
      quantity: 1,
      currency_id: 'BRL',
      unit_price: PLANS[plan].price,
    }],
    external_reference: sessionId,
    back_urls: {
      success: `${origin}?payment=success&session=${sessionId}&plan=${plan}`,
      failure: `${origin}?payment=failure&session=${sessionId}`,
      pending: `${origin}?payment=pending&session=${sessionId}`,
    },
    auto_return: 'approved',
    notification_url: `${origin.replace(/\/$/, '')}/.netlify/functions/payment-webhook?provider=mp`,
    statement_descriptor: 'VENTURECHECK',
    metadata: { session_id: sessionId, plan },
  };

  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MP_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Mercado Pago erro ${res.status}`);
  }

  const data = await res.json();
  return {
    provider: 'mp',
    checkout_url: data.init_point,
    sandbox_url:  data.sandbox_init_point,
    preference_id: data.id,
  };
}

async function createStripe(plan, sessionId, origin) {
  const STRIPE_KEY = Netlify.env.get('STRIPE_SECRET_KEY');
  if (!STRIPE_KEY) throw new Error('STRIPE_SECRET_KEY não configurado');

  const params = new URLSearchParams({
    'line_items[0][price_data][currency]': 'brl',
    'line_items[0][price_data][product_data][name]': PLANS[plan].title,
    'line_items[0][price_data][product_data][description]': PLANS[plan].description,
    'line_items[0][price_data][unit_amount]': String(PLANS[plan].price * 100),
    'line_items[0][quantity]': '1',
    mode: 'payment',
    success_url: `${origin}?payment=success&session=${sessionId}&plan=${plan}`,
    cancel_url: `${origin}?payment=failure&session=${sessionId}`,
    client_reference_id: sessionId,
    'metadata[plan]': plan,
    'metadata[session_id]': sessionId,
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(STRIPE_KEY + ':')}`,
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Stripe erro ${res.status}`);
  }

  const data = await res.json();
  return {
    provider: 'stripe',
    checkout_url: data.url,
    session_id: data.id,
  };
}

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

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { plan, sessionId } = body;
  if (!plan || !PLANS[plan]) {
    return new Response(JSON.stringify({ error: 'Plano inválido' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const origin = req.headers.get('origin') || 'https://sweet-sunburst-1eeb2f.netlify.app';
  const provider = Netlify.env.get('PAYMENT_PROVIDER') || 'mp';

  try {
    const result = provider === 'stripe'
      ? await createStripe(plan, sessionId || crypto.randomUUID(), origin)
      : await createMercadoPago(plan, sessionId || crypto.randomUUID(), origin);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

export const config = { path: '/api/checkout' };
