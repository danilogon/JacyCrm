-- =============================================================
--  SEGURA MAIS — Migração incremental
--  Execute no Supabase: SQL Editor → New query → Run
--  Seguro para rodar mesmo que parte já exista (IF NOT EXISTS)
-- =============================================================

-- ─── 1. Colunas ausentes em USUARIOS ─────────────────────────

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS acesso_consulta_renovacoes BOOLEAN DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS visualizar_lookalike        BOOLEAN DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS acesso_parcelas             BOOLEAN DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pode_importar_parcelas      BOOLEAN DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS exigir_2fa                  BOOLEAN DEFAULT false;

-- ─── 2. Colunas ausentes em TIPOS_USUARIO ────────────────────

ALTER TABLE tipos_usuario ADD COLUMN IF NOT EXISTS acesso_consulta_renovacoes BOOLEAN DEFAULT false;
ALTER TABLE tipos_usuario ADD COLUMN IF NOT EXISTS visualizar_lookalike        BOOLEAN DEFAULT false;

-- ─── 3. Tabela FORMAS_PAGAMENTO ──────────────────────────────

CREATE TABLE IF NOT EXISTS formas_pagamento (
  id   TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true
);

ALTER TABLE formas_pagamento ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'formas_pagamento' AND policyname = 'acesso_total'
  ) THEN
    CREATE POLICY "acesso_total" ON formas_pagamento FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 4. Tabela ORIGENS_PROSPECCAO ────────────────────────────

CREATE TABLE IF NOT EXISTS origens_prospeccao (
  id          TEXT PRIMARY KEY,
  nome        TEXT NOT NULL,
  is_system   BOOLEAN DEFAULT false,
  ativo       BOOLEAN DEFAULT true,
  aplicavel_a TEXT DEFAULT 'prospeccoes'
);

ALTER TABLE origens_prospeccao ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'origens_prospeccao' AND policyname = 'acesso_total'
  ) THEN
    CREATE POLICY "acesso_total" ON origens_prospeccao FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Origens do sistema (não deletáveis)
INSERT INTO origens_prospeccao (id, nome, is_system, ativo, aplicavel_a) VALUES
  ('manual',                'Manual',                    true, true, 'prospeccoes'),
  ('renovacao_perdida',     'Renovação Perdida',         true, true, 'prospeccoes'),
  ('seguro_novo_perdido',   'Seguro Novo Perdido',       true, true, 'prospeccoes')
ON CONFLICT (id) DO NOTHING;

-- ─── 5. Tabela IMPORTACOES_LOTE ──────────────────────────────

CREATE TABLE IF NOT EXISTS importacoes_lote (
  id                  TEXT PRIMARY KEY,
  tipo                TEXT NOT NULL,
  nome_arquivo        TEXT NOT NULL,
  total_importados    INTEGER DEFAULT 0,
  total_rejeitados    INTEGER DEFAULT 0,
  ids_salvos          JSONB DEFAULT '[]',
  ids_clientes_criados JSONB DEFAULT '[]',
  criado_em           TEXT NOT NULL,
  criado_por          TEXT NOT NULL,
  linhas_validas      JSONB DEFAULT '[]',
  linhas_invalidas    JSONB DEFAULT '[]'
);

ALTER TABLE importacoes_lote ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'importacoes_lote' AND policyname = 'acesso_total'
  ) THEN
    CREATE POLICY "acesso_total" ON importacoes_lote FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 6. Tabela MODELOS_EMAIL ──────────────────────────────────

CREATE TABLE IF NOT EXISTS modelos_email (
  id                TEXT PRIMARY KEY,
  nome              TEXT NOT NULL,
  assunto           TEXT NOT NULL,
  corpo             TEXT NOT NULL,
  gatilho           TEXT NOT NULL,
  ativo             BOOLEAN DEFAULT true,
  dias_antecedencia INTEGER,
  criado_em         TEXT NOT NULL
);

ALTER TABLE modelos_email ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'modelos_email' AND policyname = 'acesso_total'
  ) THEN
    CREATE POLICY "acesso_total" ON modelos_email FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 7. Tabela EMAILS_DISPARO ─────────────────────────────────

CREATE TABLE IF NOT EXISTS emails_disparo (
  id                 TEXT PRIMARY KEY,
  modelo_id          TEXT NOT NULL,
  modelo_nome        TEXT NOT NULL,
  destinatario_email TEXT NOT NULL,
  destinatario_nome  TEXT NOT NULL,
  assunto            TEXT NOT NULL,
  corpo              TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pendente',
  gatilho            TEXT NOT NULL,
  referencia_id      TEXT,
  criado_em          TEXT NOT NULL,
  enviado_em         TEXT,
  erro_msg           TEXT
);

ALTER TABLE emails_disparo ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'emails_disparo' AND policyname = 'acesso_total'
  ) THEN
    CREATE POLICY "acesso_total" ON emails_disparo FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 8. Tabela CONFIG_GATILHOS ────────────────────────────────

CREATE TABLE IF NOT EXISTS config_gatilhos (
  id                TEXT PRIMARY KEY,
  nome              TEXT NOT NULL,
  descricao         TEXT DEFAULT '',
  evento            TEXT NOT NULL,
  modelo_id         TEXT,
  ativo             BOOLEAN DEFAULT true,
  dias_antecedencia INTEGER,
  criado_em         TEXT NOT NULL
);

ALTER TABLE config_gatilhos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'config_gatilhos' AND policyname = 'acesso_total'
  ) THEN
    CREATE POLICY "acesso_total" ON config_gatilhos FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 9. Tabela PARCELAS ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS parcelas (
  id                   TEXT PRIMARY KEY,
  chave_unica          TEXT UNIQUE NOT NULL,
  primeira_atualizacao TEXT NOT NULL,
  ultima_atualizacao   TEXT NOT NULL,
  nome_cliente         TEXT NOT NULL,
  cliente_id           TEXT,
  apolice              TEXT NOT NULL,
  numero_parcela       TEXT NOT NULL,
  vencimento           TEXT NOT NULL,
  valor_parcela        NUMERIC NOT NULL DEFAULT 0,
  seguradora           TEXT NOT NULL DEFAULT '',
  forma_pagamento      TEXT NOT NULL DEFAULT '',
  ramo                 TEXT,
  status               TEXT NOT NULL DEFAULT 'importada',
  data_limite          TEXT,
  prorrogada           BOOLEAN DEFAULT false,
  data_prorrogacao     TEXT,
  observacoes          JSONB DEFAULT '[]',
  logs                 JSONB DEFAULT '[]',
  criado_em            TEXT NOT NULL,
  atualizado_em        TEXT NOT NULL
);

ALTER TABLE parcelas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'parcelas' AND policyname = 'acesso_total'
  ) THEN
    CREATE POLICY "acesso_total" ON parcelas FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 10. Tabela IMPORTACOES_PARCELAS ──────────────────────────

CREATE TABLE IF NOT EXISTS importacoes_parcelas (
  id                       TEXT PRIMARY KEY,
  nome_arquivo             TEXT NOT NULL,
  data_import              TEXT NOT NULL,
  seguradorasConsideradas  JSONB DEFAULT '[]',
  seguradorasContagem      JSONB,
  total_importadas         INTEGER DEFAULT 0,
  total_novas              INTEGER DEFAULT 0,
  total_atualizadas        INTEGER DEFAULT 0,
  total_baixadas           INTEGER DEFAULT 0,
  total_ignoradas          INTEGER DEFAULT 0,
  linhas_ignoradas         JSONB DEFAULT '[]',
  ids_salvos               JSONB DEFAULT '[]',
  criado_em                TEXT NOT NULL
);

ALTER TABLE importacoes_parcelas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'importacoes_parcelas' AND policyname = 'acesso_total'
  ) THEN
    CREATE POLICY "acesso_total" ON importacoes_parcelas FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 11. Tabela REGRAS_PARCELAS ───────────────────────────────

CREATE TABLE IF NOT EXISTS regras_parcelas (
  id              TEXT PRIMARY KEY,
  nome            TEXT NOT NULL,
  is_default      BOOLEAN DEFAULT false,
  seguradora      TEXT DEFAULT '',
  ramo            TEXT DEFAULT '',
  forma_pagamento TEXT DEFAULT '',
  ativo           BOOLEAN DEFAULT true,
  criado_em       TEXT NOT NULL,
  atualizado_em   TEXT NOT NULL
);

ALTER TABLE regras_parcelas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'regras_parcelas' AND policyname = 'acesso_total'
  ) THEN
    CREATE POLICY "acesso_total" ON regras_parcelas FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 12. Tabela AUTOMACOES_PARCELAS ───────────────────────────

CREATE TABLE IF NOT EXISTS automacoes_parcelas (
  id                    TEXT PRIMARY KEY,
  nome                  TEXT NOT NULL,
  ativo                 BOOLEAN DEFAULT true,
  tipo                  TEXT NOT NULL DEFAULT 'personalizada',
  dias_apos_vencimento  INTEGER,
  dias_antes_sem_import INTEGER,
  condicoes             JSONB DEFAULT '[]',
  operador_logico       TEXT DEFAULT 'E',
  filtro_seguradora     TEXT DEFAULT '',
  filtro_ramo           TEXT DEFAULT '',
  filtro_forma_pagamento TEXT DEFAULT '',
  alterar_status        BOOLEAN DEFAULT true,
  novo_status           TEXT NOT NULL DEFAULT 'tratar',
  acao_prorrogada       TEXT DEFAULT '',
  acao_data_prorrogacao TEXT DEFAULT '',
  acao_data_limite      TEXT DEFAULT '',
  prioridade            INTEGER DEFAULT 0,
  criado_em             TEXT NOT NULL,
  atualizado_em         TEXT NOT NULL
);

ALTER TABLE automacoes_parcelas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'automacoes_parcelas' AND policyname = 'acesso_total'
  ) THEN
    CREATE POLICY "acesso_total" ON automacoes_parcelas FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── 13. Tabela CLICKSIGN_EVENTOS (webhook) ───────────────────
-- Recebe os retornos do webhook ClickSign via /api/clicksign-webhook.
-- O frontend lê daqui para sincronizar o status dos envelopes.

CREATE TABLE IF NOT EXISTS clicksign_eventos (
  id                    TEXT PRIMARY KEY,
  envelope_id_clicksign TEXT NOT NULL,
  evento                TEXT NOT NULL,
  status_clicksign      TEXT NOT NULL,
  status_local          TEXT,
  payload               JSONB,
  recebido_em           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clicksign_eventos_envelope
  ON clicksign_eventos (envelope_id_clicksign);

ALTER TABLE clicksign_eventos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clicksign_eventos' AND policyname = 'acesso_total'
  ) THEN
    CREATE POLICY "acesso_total" ON clicksign_eventos FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- =============================================================
--  FIM DA MIGRAÇÃO
-- =============================================================
