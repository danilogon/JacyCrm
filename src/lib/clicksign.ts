/**
 * Integração ClickSign API v3
 * Fluxo: criar envelope → adicionar documento → adicionar signatário
 *        → configurar requisitos → ativar → disparar notificação
 */

const BASE_URL = 'https://app.clicksign.com/api/v3';

function headers(token: string) {
  return {
    Authorization: token,
    'Content-Type': 'application/vnd.api+json',
  };
}

export async function testarConexao(token: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const r = await fetch(`${BASE_URL}/envelopes?page[size]=1`, {
      method: 'GET',
      headers: headers(token),
    });
    if (r.status === 401 || r.status === 403) return { ok: false, erro: 'Token inválido ou sem permissão.' };
    if (!r.ok) return { ok: false, erro: `Resposta inesperada da API: ${r.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, erro: `Não foi possível conectar ao ClickSign: ${String(err)}` };
  }
}

export interface ClickSignResult {
  ok: boolean;
  envelopeId?: string;
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
    const r1 = await fetch(`${BASE_URL}/envelopes`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        data: {
          type: 'envelopes',
          attributes: { name: nomeArquivo, locale: 'pt-BR', auto_close: true },
        },
      }),
    });
    if (!r1.ok) {
      const e = await r1.json();
      return { ok: false, erro: `Erro ao criar envelope: ${JSON.stringify(e)}` };
    }
    const envelopeId: string = (await r1.json()).data.id;

    // 2. Adicionar documento
    const r2 = await fetch(`${BASE_URL}/envelopes/${envelopeId}/documents`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        data: {
          type: 'documents',
          attributes: { filename: nomeArquivo, content_base64: conteudoBase64 },
        },
      }),
    });
    if (!r2.ok) {
      const e = await r2.json();
      return { ok: false, erro: `Erro ao adicionar documento: ${JSON.stringify(e)}` };
    }
    const docId: string = (await r2.json()).data.id;

    // 3. Adicionar signatário
    const r3 = await fetch(`${BASE_URL}/envelopes/${envelopeId}/signers`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        data: {
          type: 'signers',
          attributes: { name: nomeSignatario, email: emailSignatario },
        },
      }),
    });
    if (!r3.ok) {
      const e = await r3.json();
      return { ok: false, erro: `Erro ao adicionar signatário: ${JSON.stringify(e)}` };
    }
    const signerId: string = (await r3.json()).data.id;

    const relacionamentos = {
      document: { data: { type: 'documents', id: docId } },
      signer: { data: { type: 'signers', id: signerId } },
    };

    // 4a. Requisito de assinatura (agree/sign)
    const r4a = await fetch(`${BASE_URL}/envelopes/${envelopeId}/requirements`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        data: {
          type: 'requirements',
          attributes: { action: 'agree', role: 'sign' },
          relationships: relacionamentos,
        },
      }),
    });
    if (!r4a.ok) {
      const e = await r4a.json();
      return { ok: false, erro: `Erro ao configurar requisito de assinatura: ${JSON.stringify(e)}` };
    }

    // 4b. Requisito de autenticação (provide_evidence/email)
    const r4b = await fetch(`${BASE_URL}/envelopes/${envelopeId}/requirements`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        data: {
          type: 'requirements',
          attributes: { action: 'provide_evidence', auth: 'email' },
          relationships: relacionamentos,
        },
      }),
    });
    if (!r4b.ok) {
      const e = await r4b.json();
      return { ok: false, erro: `Erro ao configurar autenticação: ${JSON.stringify(e)}` };
    }

    // 5. Ativar envelope
    const r5 = await fetch(`${BASE_URL}/envelopes/${envelopeId}`, {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify({
        data: {
          type: 'envelopes',
          id: envelopeId,
          attributes: { status: 'running' },
        },
      }),
    });
    if (!r5.ok) {
      const e = await r5.json();
      return { ok: false, erro: `Erro ao ativar envelope: ${JSON.stringify(e)}` };
    }

    // 6. Disparar notificação por e-mail
    const r6 = await fetch(`${BASE_URL}/envelopes/${envelopeId}/notifications`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        data: {
          type: 'notifications',
          attributes: { message: mensagem },
        },
      }),
    });
    if (!r6.ok) {
      // Notificação falhou mas envelope foi criado — retornamos ok com aviso
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
      linkAssinatura: `https://app.clicksign.com/envelopes/${envelopeId}`,
    };
  } catch (err) {
    return { ok: false, erro: `Erro inesperado: ${String(err)}` };
  }
}
