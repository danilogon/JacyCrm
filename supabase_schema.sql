-- =============================================================
--  SEGURA MAIS — Schema completo + dados iniciais
--  Execute no Supabase: SQL Editor → New query → Run
-- =============================================================

-- ─── TABELAS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tipos_usuario (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  role TEXT NOT NULL,
  acesso_renovacoes BOOLEAN DEFAULT true,
  acesso_seguros_novos BOOLEAN DEFAULT true,
  acesso_prospeccao BOOLEAN DEFAULT true,
  pode_descartar_prospeccao BOOLEAN DEFAULT false,
  visualizar_dashboard BOOLEAN DEFAULT true,
  visualizar_producao BOOLEAN DEFAULT false,
  visualizar_metas BOOLEAN DEFAULT true,
  visualizar_comissoes BOOLEAN DEFAULT false,
  campos_restritos JSONB DEFAULT '{"renovacoes":[],"segurosNovos":[],"prospeccoes":[]}',
  ativo BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  role TEXT NOT NULL,
  acesso_renovacoes BOOLEAN DEFAULT true,
  acesso_seguros_novos BOOLEAN DEFAULT true,
  acesso_prospeccao BOOLEAN DEFAULT true,
  pode_descartar_prospeccao BOOLEAN DEFAULT false,
  visualizar_dashboard BOOLEAN DEFAULT true,
  visualizar_producao BOOLEAN DEFAULT false,
  visualizar_metas BOOLEAN DEFAULT true,
  visualizar_comissoes BOOLEAN DEFAULT false,
  campos_restritos JSONB DEFAULT '{"renovacoes":[],"segurosNovos":[],"prospeccoes":[]}',
  recebe_remuneracao_renovacoes BOOLEAN DEFAULT false,
  plano_meta_renovacao_id TEXT,
  recebe_remuneracao_taxa_renovacoes BOOLEAN DEFAULT true,
  recebe_remuneracao_aumento_comissao BOOLEAN DEFAULT true,
  recebe_remuneracao_seguros_novos BOOLEAN DEFAULT false,
  plano_meta_seguro_novo_id TEXT,
  recebe_remuneracao_sn_comissao BOOLEAN DEFAULT true,
  recebe_remuneracao_sn_taxa BOOLEAN DEFAULT true,
  dias_permitidos JSONB DEFAULT '[]',
  config_ramos JSONB DEFAULT '[]',
  ativo BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS seguradoras (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS ramos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  tipo_comissao_seguros_novos TEXT DEFAULT 'percentual',
  percentual_comissao NUMERIC DEFAULT 0,
  valor_fixo NUMERIC DEFAULT 0,
  considerar_para_taxa_seguros_novos BOOLEAN DEFAULT true,
  considerar_para_taxa_conversao BOOLEAN DEFAULT true,
  remuneracao_individual BOOLEAN DEFAULT false,
  participa_meta_producao BOOLEAN DEFAULT false,
  apenas_controle_remuneracao BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS motivos_perda (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  considerar_taxa_conversao_renovacoes BOOLEAN DEFAULT true,
  considerar_taxa_conversao_seguros_novos BOOLEAN DEFAULT true,
  considerar_calculo_metas BOOLEAN DEFAULT true,
  gera_prospeccao BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS campos_customizaveis (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  obrigatorio BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  aplicavel_a TEXT NOT NULL,
  opcoes JSONB,
  multiplos_arquivos BOOLEAN,
  tipos_permitidos JSONB,
  tamanho_maximo_mb INTEGER
);

CREATE TABLE IF NOT EXISTS configuracoes_metas (
  id INTEGER PRIMARY KEY DEFAULT 1,
  planos_renovacao JSONB DEFAULT '[]',
  planos_seguro_novo JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS configuracao_empresa (
  id INTEGER PRIMARY KEY DEFAULT 1,
  nome TEXT DEFAULT 'Segura Mais',
  logo_url TEXT DEFAULT '',
  cor_primaria TEXT DEFAULT '#1e40af',
  cor_secundaria TEXT DEFAULT '#1d4ed8'
);

CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  cpf_cnpj TEXT,
  tipo TEXT,
  nome TEXT NOT NULL,
  email TEXT DEFAULT '',
  telefone TEXT DEFAULT '',
  data_nascimento TEXT,
  observacao_importante TEXT,
  cep TEXT DEFAULT '',
  logradouro TEXT DEFAULT '',
  numero TEXT DEFAULT '',
  complemento TEXT DEFAULT '',
  bairro TEXT DEFAULT '',
  cidade TEXT DEFAULT '',
  uf TEXT DEFAULT '',
  campos_customizados JSONB DEFAULT '[]',
  vinculos JSONB DEFAULT '[]',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS renovacoes (
  id TEXT PRIMARY KEY,
  responsavel_id TEXT,
  cliente_id TEXT,
  nome_cliente TEXT NOT NULL,
  email_cliente TEXT DEFAULT '',
  telefone_cliente TEXT DEFAULT '',
  cpf_cnpj_cliente TEXT DEFAULT '',
  fim_vigencia TEXT,
  ramo TEXT DEFAULT '',
  seguradora_anterior TEXT DEFAULT '',
  premio_anterior NUMERIC DEFAULT 0,
  percent_comissao_anterior NUMERIC DEFAULT 0,
  comissao_anterior NUMERIC DEFAULT 0,
  seguradora_nova TEXT DEFAULT '',
  premio_novo NUMERIC DEFAULT 0,
  percent_comissao_nova NUMERIC DEFAULT 0,
  comissao_nova NUMERIC DEFAULT 0,
  resultado NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'a_trabalhar',
  motivo_perda_id TEXT,
  observacoes JSONB DEFAULT '[]',
  campos_customizados JSONB DEFAULT '[]',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seguros_novos (
  id TEXT PRIMARY KEY,
  responsavel_id TEXT,
  cliente_id TEXT,
  nome_cliente TEXT NOT NULL,
  email_cliente TEXT DEFAULT '',
  telefone_cliente TEXT DEFAULT '',
  cpf_cnpj_cliente TEXT DEFAULT '',
  inicio_vigencia TEXT DEFAULT '',
  ramo TEXT DEFAULT '',
  seguradora TEXT DEFAULT '',
  premio_liquido NUMERIC DEFAULT 0,
  percent_comissao NUMERIC DEFAULT 0,
  comissao NUMERIC DEFAULT 0,
  comissao_a_receber NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'a_trabalhar',
  motivo_perda_id TEXT,
  origem TEXT DEFAULT '',
  origem_prospeccao_id TEXT,
  observacoes JSONB DEFAULT '[]',
  campos_customizados JSONB DEFAULT '[]',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prospeccoes (
  id TEXT PRIMARY KEY,
  origem TEXT DEFAULT 'manual',
  origem_id TEXT,
  responsavel_id TEXT,
  cliente_id TEXT,
  nome_cliente TEXT NOT NULL,
  email_cliente TEXT DEFAULT '',
  telefone_cliente TEXT DEFAULT '',
  cpf_cnpj_cliente TEXT DEFAULT '',
  ramo TEXT DEFAULT '',
  seguradora TEXT DEFAULT '',
  premio_referencia NUMERIC DEFAULT 0,
  data_contato TEXT,
  status TEXT DEFAULT 'a_contatar',
  motivo_perda_id TEXT,
  assumido_por TEXT,
  assumido_em TEXT,
  seguro_novo_id TEXT,
  observacoes JSONB DEFAULT '[]',
  campos_customizados JSONB DEFAULT '[]',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tarefas (
  id TEXT PRIMARY KEY,
  tipo TEXT,
  descricao TEXT,
  data_agendada TEXT,
  hora_agendada TEXT,
  responsavel_id TEXT,
  origem_tipo TEXT,
  origem_id TEXT,
  nome_cliente TEXT,
  status TEXT DEFAULT 'pendente',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS: libera acesso total para a chave anon (uso interno) ─

ALTER TABLE tipos_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguradoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE ramos ENABLE ROW LEVEL SECURITY;
ALTER TABLE motivos_perda ENABLE ROW LEVEL SECURITY;
ALTER TABLE campos_customizaveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes_metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracao_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE renovacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguros_novos ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospeccoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acesso_total" ON tipos_usuario FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "acesso_total" ON usuarios FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "acesso_total" ON seguradoras FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "acesso_total" ON ramos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "acesso_total" ON motivos_perda FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "acesso_total" ON campos_customizaveis FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "acesso_total" ON configuracoes_metas FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "acesso_total" ON configuracao_empresa FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "acesso_total" ON clientes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "acesso_total" ON renovacoes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "acesso_total" ON seguros_novos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "acesso_total" ON prospeccoes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "acesso_total" ON tarefas FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── DADOS INICIAIS ───────────────────────────────────────────

INSERT INTO tipos_usuario VALUES
  ('tu1','Administrador','Acesso total ao sistema, incluindo configurações e usuários.','admin',true,true,true,true,true,true,true,true,'{"renovacoes":[],"segurosNovos":[],"prospeccoes":[]}',true),
  ('tu2','Gestor','Visualiza e gerencia toda a produção da equipe, sem acesso a configurações.','gestor',true,true,true,true,true,true,true,false,'{"renovacoes":[],"segurosNovos":[],"prospeccoes":[]}',true),
  ('tu3','Corretor','Acesso à própria produção de renovações e seguros novos, com metas e remuneração.','usuario',true,true,true,false,true,false,true,false,'{"renovacoes":[],"segurosNovos":[],"prospeccoes":[]}',true),
  ('tu4','Assistente','Acesso apenas à carteira de renovações, sem remuneração por metas.','usuario',true,false,false,false,true,false,false,false,'{"renovacoes":[],"segurosNovos":[],"prospeccoes":[]}',true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO usuarios VALUES
  ('u1','João Silva','joao@empresa.com','123456','usuario',true,true,true,false,true,false,true,false,'{"renovacoes":[],"segurosNovos":[],"prospeccoes":[]}',true,'pmr1',true,true,true,'pmsn1',true,true,true),
  ('u2','Maria Santos','maria@empresa.com','123456','usuario',true,false,true,false,true,false,true,false,'{"renovacoes":[],"segurosNovos":[],"prospeccoes":[]}',true,'pmr1',true,false,false,null,false,false,true),
  ('u3','Pedro Costa','pedro@empresa.com','123456','usuario',false,true,true,false,true,false,true,false,'{"renovacoes":[],"segurosNovos":[],"prospeccoes":[]}',false,null,false,false,false,null,false,false,true),
  ('u4','Ana Oliveira','ana@empresa.com','123456','admin',true,true,true,true,true,true,true,true,'{"renovacoes":[],"segurosNovos":[],"prospeccoes":[]}',true,'pmr1',true,true,true,'pmsn1',true,true,true),
  ('u5','Carlos Gestor','carlos@empresa.com','123456','gestor',true,true,true,true,true,true,true,false,'{"renovacoes":[],"segurosNovos":[],"prospeccoes":[]}',true,'pmr1',true,true,true,'pmsn1',true,true,true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO seguradoras VALUES
  ('s1','Allianz',true),('s2','Bradesco Seguros',true),('s3','Itaú Seguros',true),
  ('s4','Mapfre',true),('s5','Porto Seguro',true),('s6','SulAmérica',true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO ramos VALUES
  ('r1','Auto',true,'percentual',50,0,true,true,false),
  ('r2','Residencial',true,'percentual',50,0,true,true,false),
  ('r3','Vida',true,'percentual',50,0,true,true,false),
  ('r4','Empresarial',true,'percentual',50,0,true,true,false),
  ('r5','Saúde',true,'percentual',50,0,true,true,false),
  ('r6','Viagem',true,'valor_fixo',0,50,false,false,true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO motivos_perda VALUES
  ('mr1','Cliente não renovou por preço','renovacao',true,1,true,false,true,true),
  ('mr2','Cliente mudou de seguradora','renovacao',true,2,true,false,true,true),
  ('mr3','Cliente cancelou o seguro','renovacao',true,3,true,false,true,false),
  ('mr4','Não conseguimos contato','renovacao',true,4,true,false,true,true),
  ('mr5','Cliente insatisfeito com atendimento','renovacao',true,5,true,false,true,false),
  ('mr6','Apenas simulação/consulta','renovacao',true,6,false,false,false,false),
  ('mr7','Outros motivos','renovacao',true,7,true,false,true,true),
  ('mp1','Sem interesse no momento','prospeccao',true,1,false,false,false,false),
  ('mp2','Já possui seguro com outro corretor','prospeccao',true,2,false,false,false,false),
  ('mp3','Preço não competitivo','prospeccao',true,3,false,false,false,false),
  ('mp4','Sem contato / não respondeu','prospeccao',true,4,false,false,false,false),
  ('mp5','Outros motivos','prospeccao',true,5,false,false,false,false),
  ('ms1','Preço não competitivo','seguro_novo',true,1,false,true,true,true),
  ('ms2','Cliente desistiu da contratação','seguro_novo',true,2,false,true,true,false),
  ('ms3','Documentação incompleta','seguro_novo',true,3,false,true,true,true),
  ('ms4','Cliente escolheu outro corretor','seguro_novo',true,4,false,true,true,true),
  ('ms5','Não aprovado pela seguradora','seguro_novo',true,5,false,true,true,false),
  ('ms6','Cliente não respondeu','seguro_novo',true,6,false,true,true,true),
  ('ms7','Apenas cotação/simulação','seguro_novo',true,7,false,false,false,false),
  ('ms8','Cliente teste interno','seguro_novo',true,8,false,false,false,false),
  ('ms9','Outros motivos','seguro_novo',true,9,false,true,true,true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO campos_customizaveis VALUES
  ('cc1','Número da Apólice','texto',false,true,'ambos',null,null,null,null),
  ('cc2','Data de Vistoria','data',false,true,'seguros_novos',null,null,null,null),
  ('cc3','Forma de Pagamento','lista',true,true,'ambos','["À Vista","Parcelado 2x","Parcelado 3x","Parcelado 6x","Parcelado 12x"]',null,null,null),
  ('cc4','Documentos do Veículo','arquivo',false,true,'seguros_novos',null,true,'[".pdf",".jpg",".png"]',10),
  ('cc5','Comprovante de Pagamento','arquivo',false,true,'ambos',null,false,'[".pdf",".jpg",".png"]',5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO configuracoes_metas VALUES (
  1,
  '[{"id":"pmr1","nome":"Plano Padrão","considerarSnNaTaxa":true,"taxaConversaoRenovacoes":[{"id":"tcr1","minimo":0,"maximo":90,"tipo":"percentual","valor":3},{"id":"tcr2","minimo":90.01,"maximo":95,"tipo":"percentual","valor":4},{"id":"tcr3","minimo":95.01,"maximo":null,"tipo":"valor_fixo","valor":500}],"aumentoComissao":[{"id":"ac1","minimo":10,"maximo":14.99,"tipo":"percentual","valor":1},{"id":"ac2","minimo":15,"maximo":19.99,"tipo":"percentual","valor":1.5},{"id":"ac3","minimo":20,"maximo":null,"tipo":"valor_fixo","valor":300}]}]',
  '[{"id":"pmsn1","nome":"Plano Padrão","segurosNovosPorComissao":[{"id":"snc1","minimo":5000,"maximo":9999.99,"tipo":"percentual","valor":2},{"id":"snc2","minimo":10000,"maximo":null,"tipo":"valor_fixo","valor":800}],"segurosNovosPorTaxa":[{"id":"snt1","minimo":80,"maximo":89.99,"tipo":"percentual","valor":3},{"id":"snt2","minimo":90,"maximo":null,"tipo":"valor_fixo","valor":600}]}]'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO configuracao_empresa VALUES (1,'Segura Mais','','#1e40af','#1d4ed8')
ON CONFLICT (id) DO NOTHING;

INSERT INTO clientes VALUES
  ('cl1','12345678901','PF','Roberto Almeida','roberto@email.com','11999990001','1980-05-15',null,'01310100','Av. Paulista','1000','Apto 10','Bela Vista','São Paulo','SP','2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
  ('cl2','98765432100','PF','Fernanda Lima','fernanda@email.com','11999990002','1990-08-20',null,'04538132','Av. Brigadeiro Faria Lima','2000','','Itaim Bibi','São Paulo','SP','2024-01-02T00:00:00Z','2024-01-02T00:00:00Z'),
  ('cl3','11122233344','PF','Carlos Mendes','carlos@email.com','11999990003','1975-03-10',null,'20040020','Av. Rio Branco','156','Sala 5','Centro','Rio de Janeiro','RJ','2024-01-03T00:00:00Z','2024-01-03T00:00:00Z'),
  ('cl4','12345678000195','PJ','Tech Solutions Ltda','contato@techsolutions.com','11999990004',null,null,'04711130','Av. das Nações Unidas','12901','Andar 15','Brooklin','São Paulo','SP','2024-01-04T00:00:00Z','2024-01-04T00:00:00Z'),
  ('cl5','98765432000188','PJ','Comércio Bom Preço S/A','financeiro@bompreco.com','11999990005',null,null,'30130170','Av. Afonso Pena','867','','Centro','Belo Horizonte','MG','2024-01-05T00:00:00Z','2024-01-05T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO renovacoes VALUES
  ('rv1','u1','cl1','Roberto Almeida','roberto@email.com','11999990001','12345678901','2026-05-10','Auto','Porto Seguro',2000,10,200,'Allianz',1900,12,228,28,'renovado',null,'[]','[]','2026-04-15T00:00:00Z','2026-05-02T00:00:00Z'),
  ('rv2','u1','cl2','Fernanda Lima','fernanda@email.com','11999990002','98765432100','2026-05-20','Residencial','Bradesco Seguros',1500,15,225,'SulAmérica',1600,15,240,15,'renovado',null,'[]','[]','2026-04-20T00:00:00Z','2026-05-01T00:00:00Z'),
  ('rv3','u2','cl3','Carlos Mendes','carlos@email.com','11999990003','11122233344','2026-05-05','Vida','SulAmérica',800,20,160,'',0,0,0,0,'a_trabalhar',null,'[]','[]','2026-04-10T00:00:00Z','2026-04-10T00:00:00Z'),
  ('rv4','u2','cl4','Tech Solutions Ltda','contato@techsolutions.com','11999990004','12345678000195','2026-05-12','Empresarial','Mapfre',5000,8,400,'Porto Seguro',4800,10,480,80,'pendente',null,'[]','[]','2026-04-15T00:00:00Z','2026-04-15T00:00:00Z'),
  ('rv5','u1','cl5','Comércio Bom Preço S/A','financeiro@bompreco.com','11999990005','98765432000188','2026-05-18','Auto','Itaú Seguros',3200,10,320,'',0,0,0,0,'em_orcamento',null,'[]','[]','2026-04-20T00:00:00Z','2026-04-20T00:00:00Z'),
  ('rv6','u1',null,'Paulo Rodrigues','paulo@email.com','11999990006','55566677788','2026-05-25','Saúde','Allianz',1200,15,180,'',0,0,0,0,'a_trabalhar',null,'[]','[]','2026-04-25T00:00:00Z','2026-04-25T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO seguros_novos VALUES
  ('sn1','u1','cl1','Roberto Almeida','roberto@email.com','11999990001','12345678901','2026-05-05','Auto','Porto Seguro',2500,10,250,125,'fechado',null,null,'[]','[]','2026-04-28T00:00:00Z','2026-05-05T00:00:00Z'),
  ('sn2','u3',null,'André Souza','andre@email.com','11999990007','44455566677','2026-05-15','Residencial','Bradesco Seguros',1800,15,270,135,'em_negociacao',null,null,'[]','[]','2026-05-01T00:00:00Z','2026-05-01T00:00:00Z'),
  ('sn3','u3',null,'Beatriz Costa','beatriz@email.com','11999990008','77788899900','2026-05-22','Vida','SulAmérica',600,20,120,60,'perdido','ms1',null,'[]','[]','2026-05-02T00:00:00Z','2026-05-02T00:00:00Z'),
  ('sn4','u1','cl4','Tech Solutions Ltda','contato@techsolutions.com','11999990004','12345678000195','2026-05-08','Empresarial','Mapfre',8000,8,640,320,'fechado',null,null,'[]','[]','2026-04-25T00:00:00Z','2026-05-08T00:00:00Z'),
  ('sn5','u3',null,'Diego Martins','diego@email.com','11999990009','33344455566','2026-05-12','Viagem','Allianz',300,20,60,50,'fechado',null,null,'[]','[]','2026-05-01T00:00:00Z','2026-05-12T00:00:00Z'),
  ('sn6','u1',null,'Luciana Ferreira','luciana@email.com','11999990010','22233344455','2026-05-20','Saúde','Itaú Seguros',1200,15,180,90,'a_trabalhar',null,null,'[]','[]','2026-05-02T00:00:00Z','2026-05-02T00:00:00Z'),
  ('sn-pr2','u1','cl3','Carlos Mendes','carlos@email.com','11999990003','11122233344','2026-05-15','Vida','SulAmérica',800,20,160,80,'em_negociacao',null,'pr2','[]','[]','2026-05-03T10:30:00Z','2026-05-03T10:30:00Z'),
  ('sn-pr6','u3',null,'Sofia Pereira','sofia@email.com','11966660003','99988877766','2026-05-20','Saúde','Bradesco Seguros',1400,15,210,105,'fechado',null,'pr6','[]','[]','2026-05-08T09:00:00Z','2026-05-08T09:00:00Z'),
  ('sn-pr9','u1','cl2','Fernanda Lima','fernanda@email.com','11999990002','98765432100','2026-06-01','Auto','Allianz',2800,10,280,140,'a_trabalhar',null,'pr9','[]','[]','2026-05-13T11:00:00Z','2026-05-13T11:00:00Z'),
  ('sn-pr11','u2',null,'Juliana Castro','juliana@email.com','11955550004','33322211100','2026-05-25','Vida','SulAmérica',950,20,190,95,'a_transmitir',null,'pr11','[]','[]','2026-05-07T14:00:00Z','2026-05-07T14:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO prospeccoes VALUES
  ('pr1','manual',null,'u4','cl1','Roberto Almeida','roberto@email.com','11999990001','12345678901','Auto','Allianz',2200,'2026-05-02','a_contatar',null,null,null,null,'[]','[]','2026-05-02T09:00:00Z','2026-05-02T09:00:00Z'),
  ('pr2','renovacao_perdida',null,'u4','cl3','Carlos Mendes','carlos@email.com','11999990003','11122233344','Vida','SulAmérica',800,'2026-05-01','convertido',null,'u1','2026-05-03T10:30:00Z','sn-pr2','[]','[]','2026-05-01T00:00:00Z','2026-05-03T10:30:00Z'),
  ('pr3','seguro_novo_perdido',null,'u4','cl2','Fernanda Lima','fernanda@email.com','11999990002','98765432100','Residencial','SulAmérica',1600,'2026-05-03','em_contato',null,null,null,null,'[]','[]','2026-05-03T10:00:00Z','2026-05-04T11:00:00Z'),
  ('pr4','manual',null,'u5',null,'Marcos Vieira','marcos@email.com','11988880001','66677788899','Empresarial','Mapfre',5500,'2026-05-05','proposta_enviada',null,null,null,null,'[]','[]','2026-05-05T14:00:00Z','2026-05-06T08:30:00Z'),
  ('pr5','renovacao_perdida',null,'u4','cl5','Comércio Bom Preço S/A','financeiro@bompreco.com','11999990005','98765432000188','Auto','Porto Seguro',3200,'2026-04-28','a_contatar',null,null,null,null,'[]','[]','2026-04-28T00:00:00Z','2026-04-28T00:00:00Z'),
  ('pr6','manual',null,'u5',null,'Sofia Pereira','sofia@email.com','11966660003','99988877766','Saúde','Bradesco Seguros',1400,'2026-05-07','convertido',null,'u3','2026-05-08T09:00:00Z','sn-pr6','[]','[]','2026-05-07T00:00:00Z','2026-05-08T09:00:00Z'),
  ('pr7','seguro_novo_perdido',null,'u4','cl4','Tech Solutions Ltda','contato@techsolutions.com','11999990004','12345678000195','Empresarial','Itaú Seguros',7000,'2026-04-30','a_contatar',null,null,null,null,'[]','[]','2026-04-30T00:00:00Z','2026-04-30T00:00:00Z'),
  ('pr8','manual',null,'u4',null,'Rafael Nunes','rafael@email.com','11977770002','55544433322','Auto','Porto Seguro',3000,'2026-05-10','a_contatar',null,null,null,null,'[]','[]','2026-05-10T15:00:00Z','2026-05-10T15:00:00Z'),
  ('pr9','renovacao_perdida',null,'u4','cl2','Fernanda Lima','fernanda@email.com','11999990002','98765432100','Auto','Allianz',2800,'2026-05-12','convertido',null,'u1','2026-05-13T11:00:00Z','sn-pr9','[]','[]','2026-05-12T00:00:00Z','2026-05-13T11:00:00Z'),
  ('pr10','manual',null,'u4','cl3','Carlos Mendes','carlos@email.com','11999990003','11122233344','Residencial','Mapfre',1100,'2026-04-25','descartado','mp1',null,null,null,'[]','[]','2026-04-25T00:00:00Z','2026-04-29T16:00:00Z'),
  ('pr11','manual',null,'u5',null,'Juliana Castro','juliana@email.com','11955550004','33322211100','Vida','SulAmérica',950,'2026-05-06','convertido',null,'u2','2026-05-07T14:00:00Z','sn-pr11','[]','[]','2026-05-06T00:00:00Z','2026-05-07T14:00:00Z')
ON CONFLICT (id) DO NOTHING;
