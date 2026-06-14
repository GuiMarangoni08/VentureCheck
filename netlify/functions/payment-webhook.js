// Webhook de confirmação de pagamento
// Mercado Pago: POST /.netlify/functions/payment-webhook?provider=mp
// Stripe:       POST /.netlify/functions/payment-webhook?provider=stripe

const SB_URL = 'https://ieomvpojcgokdemvyitn.supabase.co';

async function sbUpdate(sessionId, plan, paymentId, provider) {
  const SB_KEY = Netlify.env.get('SUPABASE_SERVICE_KEY') || Netlify.env.get('SUPABASE_ANON_KEY');
  if (!SB_KEY) return;

  await fetch(`${SB_URL}/rest/v1/vc_sessions?id=eq.${sessionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
    },
    body: JSON.stringify({
      status: 'paid',
      plan,
      payment_id: paymentId,
      payment_provider: provider,
      paid_at: new Date().toISOString(),
    }),
  });
}

async function handleMercadoPago(req) {
  const MP_TOKEN = Netlify.env.get('MP_ACCESS_TOKEN');
  const url = new URL(req.url);
  const topic = url.searchParams.get('topic') || url.searchParams.get('type');
  const id    = url.searchParams.get('id') || url.searchParams.get('data.id');

  if (topic !== 'payment' && topic !== 'payment_intent') return { ok: true };

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  });
  if (!res.ok) return { ok: false, error: 'payment lookup failed' };

  const payment = await res.json();
  if (payment.status !== 'approved') return { ok: true };

  const sessionId = payment.external_reference || payment.metadata?.session_id;
  const plan      = payment.metadata?.plan;
  if (sessionId) await sbUpdate(sessionId, plan, String(payment.id), 'mp');

  return { ok: true };
}

async function handleStripe(req) {
  const body = await req.text();
  let event;
  try { event = JSON.parse(body); } catch { return { ok: false, error: 'invalid body' }; }

  if (event.type !== 'checkout.session.completed') return { ok: true };

  const session   = event.data?.object;
  const sessionId = session?.client_reference_id || session?.metadata?.session_id;
  const plan      = session?.metadata?.plan;
  if (sessionId) await sbUpdate(sessionId, plan, session.id, 'stripe');

  return { ok: true };
}

export default async (req, context) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const url      = new URL(req.url);
  const provider = url.searchParams.get('provider') || 'mp';

  try {
    const result = provider === 'stripe'
      ? await handleStripe(req)
      : await handleMercadoPago(req);
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const config = { path: '/api/payment-webhook' };
