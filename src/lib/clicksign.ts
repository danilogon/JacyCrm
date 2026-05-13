/**
 * Integração ClickSign API v3
 * Todas as chamadas passam pelo proxy /api/clicksign-proxy (evita CORS + CSP).
 * Fluxo: criar envelope → adicionar documento → adicionar signatário
 *        → configurar requisitos → ativar → disparar notificação
 */

async function callProxy(token: string, path: string, method = 'GET', body?: unknown) {
  const res = await fetch('/api/clicksign-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, path, method, body }),
  });
  return { status: res.status, ok: res.ok, data: await res.json() };
}

/**
 * Busca o ID do primeiro documento de um envelope via API v3.
 * O ID do documento (v3) é equivalente à chave usada nos webhooks v1/v2,
 * permitindo fazer o match entre eventos recebidos e envelopes locais.
 */
export async function buscarDocumentId(
  token: string,
  envelopeId: string,
): Promise<string | null> {
  try {
    const r = await callProxy(token, `envelopes/${envelopeId}/documents`);
    const id = r.data?.data?.[0]?.id ?? null;
    return id;
  } catch {
    return null;
  }
}

/**
 * Consulta o status atual de um envelope diretamente na API do ClickSign.
 * Retorna o status local mapeado ou null se não reconhecido/erro.
 */
export async function buscarStatusEnvelope(
  token: string,
  envelopeId: string,
): Promise<'enviado' | 'assinado' | 'cancelado' | 'expirado' | null> {
  const STATUS_MAP: Record<string, 'enviado' | 'assinado' | 'cancelado' | 'expirado'> = {
    completed: 'assinado',
    closed:    'assinado',   // v1/v2 e algumas respostas v3 usam "closed"
    signed:    'assinado',
    canceled:  'cancelado',
    cancelled: 'cancelado',
    expired:   'expirado',
    running:   'enviado',
    draft:     'enviado',
  };
  try {
    const r = await callProxy(token, `envelopes/${envelopeId}`);
    if (!r.ok) return null;
    const status: string =
      r.data?.data?.attributes?.status ??
      r.data?.data?.status ??
      r.data?.status ??
      '';
    return STATUS_MAP[status] ?? null;
  } catch {
    return null;
  }
}

export async function testarConexao(token: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const r = await callProxy(token, 'envelopes?page[size]=1');
    if (r.status === 401 || r.status === 403) return { ok: false, erro: 'Token inválido ou sem permissão.' };
    if (!r.ok) return { ok: false, erro: `Resposta inesperada da API: ${r.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, erro: `Não foi possível conectar ao ClickSign: ${String(err)}` };
  }
}

export async function baixarDocumentoAssinado(
  token: string,
  envelopeId: string,
): Promise<{ ok: boolean; blobUrl?: string; erro?: string }> {
  try {
    const res = await fetch('/api/clicksign-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, envelopeId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, erro: data.error ?? `Erro ${res.status}` };
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    return { ok: true, blobUrl };
  } catch (err) {
    return { ok: false, erro: `Não foi possível baixar o documento: ${String(err)}` };
  }
}

export interface ClickSignResult {
  ok: boolean;
  envelopeId?: string;
  documentId?: string; // ID do documento v3 (= chave v1 para matching do webhook)
  linkAssinatura?: string;
  erro?: string;
}

export async function enviarDocumentoParaAssinatura(params: {
  token: string;
  nomeArquivo: string;
  conteudoBase64: string; // "data:application/pdf;base64,..."
  nomeSignatario: string;
  emailSignatario: string;
  mensagem: string;
}): Promise<ClickSignResult> {
  const { token, nomeArquivo, conteudoBase64, nomeSignatario, emailSignatario, mensagem } = params;

  try {
    // 1. Criar envelope
    const r1 = await callProxy(token, 'envelopes', 'POST', {
      data: { type: 'envelopes', attributes: { name: nomeArquivo, locale: 'pt-BR', auto_close: true } },
    });
    if (!r1.ok) return { ok: false, erro: `Erro ao criar envelope: ${JSON.stringify(r1.data)}` };
    const envelopeId: string = r1.data.data.id;

    // 2. Adicionar documento
    const r2 = await callProxy(token, `envelopes/${envelopeId}/documents`, 'POST', {
      data: { type: 'documents', attributes: { filename: nomeArquivo, content_base64: conteudoBase64 } },
    });
    if (!r2.ok) return { ok: false, erro: `Erro ao adicionar documento: ${JSON.stringify(r2.data)}` };
    const docId: string = r2.data.data.id;

    // 3. Adicionar signatário
    const r3 = await callProxy(token, `envelopes/${envelopeId}/signers`, 'POST', {
      data: { type: 'signers', attributes: { name: nomeSignatario, email: emailSignatario } },
    });
    if (!r3.ok) return { ok: false, erro: `Erro ao adicionar signatário: ${JSON.stringify(r3.data)}` };
    const signerId: string = r3.data.data.id;

    const relacionamentos = {
      document: { data: { type: 'documents', id: docId } },
      signer:   { data: { type: 'signers',   id: signerId } },
    };

    // 4a. Requisito de assinatura (agree/sign)
    const r4a = await callProxy(token, `envelopes/${envelopeId}/requirements`, 'POST', {
      data: { type: 'requirements', attributes: { action: 'agree', role: 'sign' }, relationships: relacionamentos },
    });
    if (!r4a.ok) return { ok: false, erro: `Erro ao configurar requisito de assinatura: ${JSON.stringify(r4a.data)}` };

    // 4b. Requisito de autenticação (provide_evidence/email)
    const r4b = await callProxy(token, `envelopes/${envelopeId}/requirements`, 'POST', {
      data: { type: 'requirements', attributes: { action: 'provide_evidence', auth: 'email' }, relationships: relacionamentos },
    });
    if (!r4b.ok) return { ok: false, erro: `Erro ao configurar autenticação: ${JSON.stringify(r4b.data)}` };

    // 5. Ativar envelope
    const r5 = await callProxy(token, `envelopes/${envelopeId}`, 'PATCH', {
      data: { type: 'envelopes', id: envelopeId, attributes: { status: 'running' } },
    });
    if (!r5.ok) return { ok: false, erro: `Erro ao ativar envelope: ${JSON.stringify(r5.data)}` };

    // 6. Disparar notificação por e-mail
    const r6 = await callProxy(token, `envelopes/${envelopeId}/notifications`, 'POST', {
      data: { type: 'notifications', attributes: { message: mensagem } },
    });
    if (!r6.ok) {
      return {
        ok: true,
        envelopeId,
        linkAssinatura: `https://app.clicksign.com/envelopes/${envelopeId}`,
        erro: 'Envelope criado mas houve falha ao enviar e-mail. Notifique o signatário manualmente.',
      };
    }

    return {
      ok: true,
      envelopeId,
      documentId: docId,
      linkAssinatura: `https://app.clicksign.com/envelopes/${envelopeId}`,
    };
  } catch (err) {
    return { ok: false, erro: `Erro inesperado: ${String(err)}` };
  }
}
