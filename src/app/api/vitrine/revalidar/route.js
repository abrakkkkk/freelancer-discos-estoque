export async function POST(request) {
  const vitrineUrl = process.env.VITRINE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!vitrineUrl || !secret) return new Response(null, { status: 204 });

  const corpo = await request.json().catch(() => null);
  if (!corpo?.categoria || !Array.isArray(corpo.ids)) {
    return Response.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  try {
    const resposta = await fetch(new URL('/api/revalidar', vitrineUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': secret },
      body: JSON.stringify({ categoria: corpo.categoria, ids: corpo.ids }),
      signal: AbortSignal.timeout(8000),
    });
    return new Response(null, { status: resposta.ok ? 204 : 502 });
  } catch {
    return new Response(null, { status: 502 });
  }
}
