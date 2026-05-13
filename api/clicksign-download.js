/**
 * Proxy para download do documento assinado via ClickSign API v3.
 * Recebe { token, envelopeId } e retorna o PDF assinado.
 */

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
    // ClickSign v3: GET /api/v3/envelopes/{id}/download retorna o PDF assinado
    const url = `https://app.clicksign.com/api/v3/envelopes/${envelopeId}/download?access_token=${token}`;

    const r = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { Accept: 'application/pdf, application/octet-stream, */*' },
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      res.status(r.status).json({ error: `ClickSign retornou ${r.status}: ${text}` });
      return;
    }

    const contentType = r.headers.get('content-type') || 'application/pdf';
    const buffer = Buffer.from(await r.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="documento-assinado-${envelopeId}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error('[clicksign-download] Erro:', err);
    res.status(500).json({ error: String(err) });
  }
}
