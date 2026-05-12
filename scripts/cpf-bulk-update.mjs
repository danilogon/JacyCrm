/**
 * cpf-bulk-update.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Busca todos os clientes com CPF (11 dígitos) que estejam sem data de
 * nascimento ou sem sexo, consulta a API CPF Brasil e atualiza o Supabase.
 *
 * Como usar:
 *   1. Abra o Supabase Dashboard → Settings → API
 *   2. Copie a "service_role secret" e cole em SUPABASE_SERVICE_KEY abaixo
 *   3. No terminal, na pasta raiz do projeto, execute:
 *        node scripts/cpf-bulk-update.mjs
 *
 * Dica: para fazer um teste antes de comprar o pacote, mantenha MAX_CLIENTES = 3
 *       e verifique se os dados aparecem corretos no sistema. Depois remova o limite.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import https from 'https';

// ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────

const SUPABASE_URL        = 'https://novfhetxargozmceelee.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vdmZoZXR4YXJnb3ptY2VlbGVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg5OTEzOCwiZXhwIjoyMDkzNDc1MTM4fQ.2oSCfmb2wRecknwL51HAP_2qTQGWFfrnxGflIQcat2o';
const CPF_API_KEY         = '9ccf048d4f396fae0620a27ea3be07b28b714dc3d5b7d94f163d8bdd8ef5cd92';

/** Intervalo entre chamadas à API (ms). 1500 = ~40 chamadas/minuto */
const DELAY_MS = 1500;

/**
 * Limite de clientes a processar nesta execução.
 * Útil para testar antes de usar cota real.
 * Use Infinity para processar todos.
 */
const MAX_CLIENTES = Infinity;

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function barra(atual, total, tamanho = 30) {
  const pct  = atual / total;
  const feito = Math.round(pct * tamanho);
  return `[${'█'.repeat(feito)}${'░'.repeat(tamanho - feito)}] ${String(atual).padStart(String(total).length)}/${total}`;
}

// ─── SUPABASE REST API ────────────────────────────────────────────────────────

const sbHeaders = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
};

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
  if (!res.ok) throw new Error(`Supabase GET falhou: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supabaseUpdate(id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${id}`, {
    method : 'PATCH',
    headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body   : JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase PATCH falhou: ${res.status} ${await res.text()}`);
}

// ─── CPF BRASIL API ───────────────────────────────────────────────────────────

function callCpfApi(cpf) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.cpf-brasil.org',
        path    : `/cpf/${cpf}`,
        method  : 'GET',
        headers : { 'X-API-Key': CPF_API_KEY, 'Content-Type': 'application/json' },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch { resolve({ success: false, error: 'parse error', raw: body.slice(0, 100) }); }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════');
  console.log('  CPF Bulk Update — Segura Mais');
  console.log('══════════════════════════════════════════════════');

  if (SUPABASE_SERVICE_KEY === 'COLE_AQUI_SUA_SERVICE_ROLE_KEY') {
    console.error('\n❌ Configure SUPABASE_SERVICE_KEY no topo do arquivo antes de executar.\n');
    process.exit(1);
  }

  // 1. Busca clientes com dados incompletos (paginando de 1000 em 1000)
  console.log('\n🔍 Buscando clientes com dados incompletos...');
  const todos = [];
  const PAGE  = 1000;
  let   from  = 0;
  while (true) {
    const page = await supabaseGet(
      'clientes?select=id,nome,cpf_cnpj,data_nascimento,sexo' +
      '&or=(data_nascimento.is.null,sexo.is.null,sexo.eq.)' +
      `&limit=${PAGE}&offset=${from}`,
    );
    if (!Array.isArray(page)) {
      console.error('Erro inesperado ao buscar clientes:', page);
      process.exit(1);
    }
    todos.push(...page);
    if (page.length < PAGE) break;
    from += PAGE;
    process.stdout.write(`\r  Carregados: ${todos.length}...`);
  }
  console.log(`\r  Carregados: ${todos.length} registros com dados incompletos`);

  // 2. Filtra apenas CPFs (11 dígitos) — exclui CNPJs (14 dígitos)
  const alvos = todos
    .filter((c) => (c.cpf_cnpj || '').replace(/\D/g, '').length === 11)
    .slice(0, MAX_CLIENTES === Infinity ? undefined : MAX_CLIENTES);

  if (alvos.length === 0) {
    console.log('\n✅ Nenhum cliente com CPF e dados incompletos encontrado. Banco já atualizado!\n');
    return;
  }

  const estimSeg = Math.ceil((alvos.length * DELAY_MS) / 1000);
  const estimMin = (estimSeg / 60).toFixed(1);
  console.log(`\n📋 Clientes para processar : ${alvos.length}`);
  console.log(`⏱️  Tempo estimado          : ~${estimMin} minuto(s)`);
  console.log(`🔑 Cota de API usada        : ${alvos.length} consulta(s)\n`);

  // 3. Processa cada cliente
  let atualizados  = 0;
  let semDados     = 0; // CPF não encontrado na API
  let semAlteracao = 0; // API retornou mas não havia campo novo
  let erros        = 0;

  const log = [];

  for (let i = 0; i < alvos.length; i++) {
    const c   = alvos[i];
    const cpf = c.cpf_cnpj.replace(/\D/g, '');
    const label = `${c.nome || '(sem nome)'} · ${cpf}`;

    process.stdout.write(`\r${barra(i + 1, alvos.length)}  `);

    let resultado;
    try {
      const resp = await callCpfApi(cpf);

      if (resp?.success && resp?.data?.NOME) {
        const d      = resp.data;
        const update = {};

        // Preenche data_nascimento se ausente
        if (!c.data_nascimento && d.NASC) {
          const parts = String(d.NASC).split('/');
          if (parts.length === 3) {
            update.data_nascimento = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }

        // Preenche sexo se ausente ou vazio
        if ((!c.sexo || c.sexo === '') && d.SEXO) {
          update.sexo = d.SEXO === 'Feminino' ? 'F' : d.SEXO === 'Masculino' ? 'M' : null;
        }

        if (Object.keys(update).length > 0) {
          await supabaseUpdate(c.id, update);
          atualizados++;
          resultado = `✅ atualizado → ${JSON.stringify(update)}`;
        } else {
          semAlteracao++;
          resultado = '⏭️  já possuía os dados';
        }
      } else {
        semDados++;
        const motivo = resp?.error || resp?.message || 'não encontrado';
        resultado = `❌ ${motivo}`;
      }
    } catch (err) {
      erros++;
      resultado = `💥 erro: ${err.message}`;
    }

    log.push(`${String(i + 1).padStart(4)}. ${label}\n      ${resultado}`);

    if (i < alvos.length - 1) await sleep(DELAY_MS);
  }

  // 4. Exibe log completo
  console.log('\n\n──────────────────────────────────────────────────');
  console.log('  Log detalhado');
  console.log('──────────────────────────────────────────────────');
  log.forEach((l) => console.log(l));

  // 5. Resumo final
  console.log('\n══════════════════════════════════════════════════');
  console.log('  Resumo');
  console.log('══════════════════════════════════════════════════');
  console.log(`  ✅ Atualizados         : ${atualizados}`);
  console.log(`  ⏭️  Já tinham os dados  : ${semAlteracao}`);
  console.log(`  ❌ Não encontrados      : ${semDados}`);
  console.log(`  💥 Erros               : ${erros}`);
  console.log(`  📊 Total processados   : ${alvos.length}`);
  console.log('══════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('\n💥 Erro fatal:', err.message);
  process.exit(1);
});
