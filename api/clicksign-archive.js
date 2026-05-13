/**
 * Baixa o PDF assinado do ClickSign e salva permanentemente no Supabase Storage.
 * Chamado automaticamente ao detectar envelope recém-assinado.
 *
 * Requer variáveis de ambiente no Vercel:
 *   SUPABASE_URL              — ex: https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — chave service_role do Supabase (não a anon key)
 */

const BUCKET   = 'assinaturas';
const BASE_V1  = 'https://app.clicksign.com/api/v1';
const BASE_V3  = 'https://app.clicksign.com/api/v3';

function rawToken(token) {
  return token.replace(/^Bearer\s+/i, '').trim();
}

async function downloadPdf(token, envelopeId, documentKey) {
  const at = rawToken(token);

  // Tentativa 1: API v1 retorna JSON com URL direta do PDF assinado
  if (documentKey) {
    try {
      const r = await fetch(`${BASE_V1}/documents/${documentKey}?access_token=${at}`, {
        headers: { Accept: 'application/json' },
      });
      if (r.ok) {
        const j = await r.json().catch(() => null);
        const url =
          j?.document?.downloads?.signed_file_url ??
          j?.document?.download_link ??
          j?.document?.file_url ??
          j?.document?.signed_file_url ??
          null;
        if (url) {
          const pdfRes = await fetch(url);
          if (pdfRes.ok) return Buffer.from(await pdfRes.arrayBuffer());
        }
      }
    } catch { /* segue para próxima tentativa */ }
  }

  // Tentativa 2: API v3 com captura de redirect 302 → URL S3
  for (const path of [
    docId => `${BASE_V3}/envelopes/${envelopeId}/documents/${docId}/download`,
    ()    => `${BASE_V3}/envelopes/${envelopeId}/download`,
  ]) {
    const url = typeof path === 'function' ? path(documentKey) : path;
    if (!url || url.includes('/undefined/')) continue;
    try {
      const r = await fetch(url, {
        redirect: 'manual',
        headers: { Authorization: token, Accept: 'application/pdf, */*' },
      });
      if (r.status >= 301 && r.status <= 308) {
        const loc = r.headers.get('location');
        if (loc) {
          const pdfRes = await fetch(loc);
          if (pdfRes.ok) return Buffer.from(await pdfRes.arrayBuffer());
        }
      }
      if (r.ok) {
        const ct = r.headers.get('content-type') ?? '';
        if (ct.includes('pdf') || ct.includes('octet-stream')) {
          return Buffer.from(await r.arrayBuffer());
        }
      }
    } catch { /* segue */ }
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({
      error: 'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configurados no servidor.',
    });
  }

  const { token, envelopeId, documentKey, nomeDocumento } = req.body ?? {};
  if (!token || !envelopeId) {
    return res.status(400).json({ error: 'token e envelopeId são obrigatórios' });
  }

  try {
    // Garante que o bucket existe (público — URL permanente sem expiração)
    await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
    }); // 409 se já existir — ignoramos

    const pdfBuf = await downloadPdf(token, envelopeId, documentKey);
    if (!pdfBuf?.length) {
      return res.status(502).json({ error: 'Não foi possível baixar o PDF do ClickSign.' });
    }

    const safeName = (nomeDocumento || 'documento-assinado.pdf')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${envelopeId}/${safeName}`;

    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/pdf',
          'x-upsert': 'true',
        },
        body: pdfBuf,
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return res.status(502).json({ error: `Erro ao salvar no Supabase Storage: ${err}` });
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
    console.log(`[clicksign-archive] Salvo: ${publicUrl}`);
    return res.status(200).json({ url: publicUrl });

  } catch (err) {
    console.error('[clicksign-archive] Erro:', err);
    return res.status(500).json({ error: String(err) });
  }
}
