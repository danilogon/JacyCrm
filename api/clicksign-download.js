/**
 * Retorna a URL de download do documento assinado via ClickSign API v3.
 *
 * ClickSign responde ao endpoint de download com um redirect 302 para um
 * URL S3 pré-assinado. Capturamos esse URL sem seguir o redirect e
 * devolvemos ao frontend, que abre o PDF diretamente no navegador.
 */

const BASE = 'https://app.clicksign.com/api/v3';

async function csGet(token, path, followRedirect = false) {
  return fetch(`${BASE}/${path}`, {
    method: 'GET',
    redirect: followRedirect ? 'follow' : 'manual',
    headers: {
      Authorization: token,
      Accept: 'application/pdf, application/octet-stream, application/json, */*',
    },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const { token, envelopeId } = req.body ?? {};
  if (!token || !envelopeId) {
    res.status(400).json({ error: 'token e envelopeId são obrigatórios' });
    return;
  }

  try {
    // 1. Busca ID do primeiro documento do envelope
    const docsR = await csGet(token, `envelopes/${envelopeId}/documents`, true);
    let docId = null;
    if (docsR.ok) {
      const j = await docsR.json().catch(() => null);
      docId = j?.data?.[0]?.id ?? null;
    }

    // 2. Tenta capturar redirect 302 do endpoint de download
    // Ordem: documento específico → envelope genérico
    const paths = docId
      ? [
          `envelopes/${envelopeId}/documents/${docId}/download`,
          `envelopes/${envelopeId}/download`,
        ]
      : [`envelopes/${envelopeId}/download`];

    for (const path of paths) {
      const r = await csGet(token, path, false); // sem seguir redirect

      // Redirect → Location é o URL S3 pré-assinado
      if (r.status === 301 || r.status === 302 || r.status === 307 || r.status === 308) {
        const location = r.headers.get('location') ?? r.headers.get('Location');
        if (location) {
          res.status(200).json({ url: location });
          return;
        }
      }

      // Resposta direta com PDF ou JSON contendo URL
      if (r.status >= 200 && r.status < 300) {
        const ct = r.headers.get('content-type') ?? '';

        if (ct.includes('pdf') || ct.includes('octet-stream')) {
          // Arquivo retornado diretamente — faz proxy do binário
          const buf = Buffer.from(await r.arrayBuffer());
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline; filename="documento-assinado.pdf"');
          res.send(buf);
          return;
        }

        if (ct.includes('json')) {
          const j = await r.json().catch(() => null);
          const url =
            j?.data?.attributes?.url ??
            j?.data?.attributes?.download_url ??
            j?.url ??
            j?.download_url ??
            null;
          if (url) {
            res.status(200).json({ url });
            return;
          }
          // Loga o JSON para diagnóstico e continua para o próximo path
          console.log('[clicksign-download] JSON sem url:', JSON.stringify(j).slice(0, 400));
        }
      }
    }

    // 3. Nenhuma estratégia funcionou — devolve erro informativo
    res.status(502).json({
      error: 'Não foi possível obter o link de download. Verifique se o documento está assinado no ClickSign.',
    });

  } catch (err) {
    console.error('[clicksign-download] Erro:', err);
    res.status(500).json({ error: String(err) });
  }
}
