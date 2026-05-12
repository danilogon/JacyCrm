export type Role = 'admin' | 'gestor' | 'usuario';

export interface TipoUsuario {
  id: string;
  nome: string;
  descricao: string;
  role: Role;
  acessoRenovacoes: boolean;
  acessoSegurosNovos: boolean;
  acessoProspeccao: boolean;
  podeDescartarProspeccao: boolean;
  acessoConsultaRenovacoes: boolean;
  visualizarDashboard: boolean;
  visualizarProducao: boolean;
  visualizarMetas: boolean;
  visualizarComissoes: boolean;
  visualizarLookalike: boolean;
  camposRestritos: {
    renovacoes: string[];
    segurosNovos: string[];
    prospeccoes: string[];
  };
  ativo: boolean;
}

export interface ConfigRamoUsuario {
  ramoId: string;
  recebeIndividual: boolean;
  recebeMeta: boolean;
}

export interface Usuario {
  id: string;
  authUid?: string;
  nome: string;
  email: string;
  senha?: string;
  role: Role;
  acessoRenovacoes: boolean;
  acessoSegurosNovos: boolean;
  acessoProspeccao?: boolean;
  podeDescartarProspeccao?: boolean;
  acessoConsultaRenovacoes?: boolean;
  visualizarDashboard?: boolean;
  visualizarProducao?: boolean;
  visualizarMetas?: boolean;
  visualizarComissoes?: boolean;
  visualizarLookalike?: boolean;
  camposRestritos?: {
    renovacoes: string[];
    segurosNovos: string[];
    prospeccoes: string[];
  };
  recebeRemuneracaoRenovacoes: boolean;
  planoMetaRenovacaoId?: string;
  recebeRemuneracaoTaxaRenovacoes: boolean;
  recebeRemuneracaoAumentoComissao: boolean;
  recebeRemuneracaoSegurosNovos: boolean;
  planoMetaSeguroNovoId?: string;
  recebeRemuneracaoSnComissao: boolean;
  recebeRemuneracaoSnTaxa: boolean;
  ativo: boolean;
  /** ID do tipo de usuário aplicado (referência a TipoUsuario) */
  tipoUsuarioId?: string;
  /** Horário mínimo permitido para login, ex: "07:00". Null = sem restrição. */
  horarioLoginInicio?: string;
  /** Horário máximo permitido para login, ex: "17:00". Null = sem restrição. */
  horarioLoginFim?: string;
  /** Dias da semana permitidos para login: 0=Dom, 1=Seg … 6=Sáb. Vazio/undefined = todos os dias. */
  diasPermitidos?: number[];
  /** Configuração de remuneração por ramo (para ramos com remuneracaoIndividual: true) */
  configRamos?: ConfigRamoUsuario[];
  /** Requer código 2FA enviado por e-mail a cada login */
  exigir2FA?: boolean;
}

export type StatusRenovacao =
  | 'a_trabalhar'
  | 'em_orcamento'
  | 'em_negociacao'
  | 'vencidas'
  | 'a_transmitir'
  | 'pendente'
  | 'renovado'
  | 'nao_renovada';

export type StatusSeguroNovo =
  | 'a_trabalhar'
  | 'em_orcamento'
  | 'em_negociacao'
  | 'vencidas'
  | 'a_transmitir'
  | 'pendente'
  | 'fechado'
  | 'perdido';

export type StatusProspeccao =
  | 'a_contatar'
  | 'em_contato'
  | 'proposta_enviada'
  | 'convertido'
  | 'descartado';

export interface OrigemProspeccao {
  id: string;        // 'manual' | 'renovacao_perdida' | 'seguro_novo_perdido' | any custom slug/uuid
  nome: string;      // display label
  isSystem: boolean; // true = locked, cannot be deleted
  ativo: boolean;
  /** Onde esta origem aparece: apenas prospecções, apenas seguros novos ou ambos. Origens do sistema são sempre 'prospeccoes'. */
  aplicavelA?: 'prospeccoes' | 'seguros_novos' | 'ambos';
}

export interface ArquivoAnexo {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  dataBase64: string;
}

export interface Observacao {
  id: string;
  texto: string;
  autor: string;
  data: string;
  arquivos: ArquivoAnexo[];
}

export interface CampoCustomizadoValor {
  campoId: string;
  valor: string | string[];
}

export interface Renovacao {
  id: string;
  responsavelId: string;
  clienteId?: string;
  nomeCliente: string;
  emailCliente: string;
  telefoneCliente: string;
  cpfCnpjCliente: string;
  fimVigencia: string;
  ramo: string;
  seguradoraAnterior: string;
  premioAnterior: number;
  percentComissaoAnterior: number;
  comissaoAnterior: number;
  seguradoraNova: string;
  premioNovo: number;
  percentComissaoNova: number;
  comissaoNova: number;
  resultado: number;
  status: StatusRenovacao;
  motivoPerdaId?: string;
  observacoes: Observacao[];
  camposCustomizados: CampoCustomizadoValor[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface SeguroNovo {
  id: string;
  responsavelId: string;
  clienteId?: string;
  nomeCliente: string;
  emailCliente: string;
  telefoneCliente: string;
  cpfCnpjCliente: string;
  inicioVigencia: string;
  ramo: string;
  seguradora: string;
  premioLiquido: number;
  percentComissao: number;
  comissao: number;
  comissaoAReceber: number;
  status: StatusSeguroNovo;
  motivoPerdaId?: string;
  origem?: string;             // id da OrigemProspeccao selecionada
  origemProspeccaoId?: string; // vinculado quando assumido da prospecção
  observacoes: Observacao[];
  camposCustomizados: CampoCustomizadoValor[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface Prospeccao {
  id: string;
  origem: string;
  origemId?: string;
  responsavelId: string;
  clienteId?: string;
  nomeCliente: string;
  emailCliente: string;
  telefoneCliente: string;
  cpfCnpjCliente: string;
  dataNascimentoCliente?: string;
  ramo: string;
  seguradora: string;
  premioReferencia: number;
  dataContato: string;
  status: StatusProspeccao;
  motivoPerdaId?: string;
  assumidoPor?: string;    // userId de quem assumiu a prospecção
  assumidoEm?: string;     // timestamp ISO de quando foi assumida
  seguroNovoId?: string;   // id do SeguroNovo criado ao assumir
  observacoes: Observacao[];
  camposCustomizados: CampoCustomizadoValor[];
  criadoEm: string;
  atualizadoEm: string;
}

export type TipoVinculo = 'Cônjuge' | 'Filho(a)' | 'Pai/Mãe' | 'Sócio(a)' | 'Outro';

export interface VinculoCliente {
  clienteId: string;
  tipo: TipoVinculo;
}

export interface Cliente {
  id: string;
  cpfCnpj: string;
  tipo: 'PF' | 'PJ';
  nome: string;
  email: string;
  telefone: string;
  dataNascimento?: string;
  sexo?: 'M' | 'F' | '';
  observacaoImportante?: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  camposCustomizados?: CampoCustomizadoValor[];
  vinculos?: VinculoCliente[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface Seguradora {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface Ramo {
  id: string;
  nome: string;
  ativo: boolean;
  tipoComissaoSegurosNovos: 'percentual' | 'valor_fixo';
  percentualComissao: number;
  valorFixo: number;
  considerarParaTaxaSegurosNovos: boolean;
  considerarParaTaxaConversao: boolean;
  /** Quando true, a comissão é paga individualmente por venda (fora da meta de produção mensal) */
  remuneracaoIndividual: boolean;
  /** Quando true, este ramo também contribui para a meta de produção mesmo sendo individual */
  participaMetaProducao?: boolean;
  /**
   * Quando true, os registros deste ramo NÃO são contabilizados em:
   * negócios fechados, prêmio líquido total, comissão total, média de % comissão
   * nem nos rankings do dashboard. Usado para produtos auxiliares (ex: Cartão Porto)
   * que geram remuneração individual mas não são seguros em si.
   */
  apenasControleRemuneracao?: boolean;
}

export interface FaixaMeta {
  id: string;
  minimo: number;
  maximo: number | null;
  tipo: 'percentual' | 'valor_fixo';
  valor: number;
}

export interface PlanoMetaRenovacao {
  id: string;
  nome: string;
  /** Se true, seguros novos fechados (de ramos elegíveis) entram no cálculo da taxa de conversão de renovações */
  considerarSnNaTaxa: boolean;
  taxaConversaoRenovacoes: FaixaMeta[];
  aumentoComissao: FaixaMeta[];
}

export interface PlanoMetaSeguroNovo {
  id: string;
  nome: string;
  segurosNovosPorComissao: FaixaMeta[];
  segurosNovosPorTaxa: FaixaMeta[];
}

export interface ConfiguracoesMetas {
  planosRenovacao: PlanoMetaRenovacao[];
  planosSeguroNovo: PlanoMetaSeguroNovo[];
}

export interface MotivoPerda {
  id: string;
  nome: string;
  /** 'negocio' = aparece em renovações/seguros novos; 'prospeccao' = aparece ao descartar prospecções */
  tipo: 'negocio' | 'prospeccao';
  /** Exibir este motivo ao marcar renovação como perdida */
  aplicaRenovacoes: boolean;
  /** Exibir este motivo ao marcar seguro novo como perdido */
  aplicaSegurosNovos: boolean;
  ativo: boolean;
  ordem: number;
  considerarTaxaConversaoRenovacoes: boolean;
  considerarTaxaConversaoSegurosNovos: boolean;
  considerarCalculoMetas: boolean;
  geraProspeccao: boolean;
}

export type TipoCampoCustom = 'texto' | 'data' | 'lista' | 'arquivo';

export interface CampoCustomizavel {
  id: string;
  nome: string;
  tipo: TipoCampoCustom;
  obrigatorio: boolean;
  ativo: boolean;
  /** 'ambos' = renovações + seguros novos; 'todos' = os três módulos */
  aplicavelA: 'renovacoes' | 'seguros_novos' | 'prospeccoes' | 'ambos' | 'todos' | 'seguros_novos_prospeccoes' | 'clientes';
  /** Lista de ramos (nome) aos quais o campo se aplica; vazio = todos os ramos */
  ramosAplicaveis?: string[];
  opcoes?: string[];
  multiplosArquivos?: boolean;
  tiposPermitidos?: string[];
  tamanhoMaximoMb?: number;
}

export interface ConfiguracaoEmpresa {
  nome: string;
  logoUrl: string;
  corPrimaria: string;
  corSecundaria: string;
}

export type TipoTarefa = 'ligacao' | 'email' | 'reuniao' | 'visita' | 'outro';
export type StatusTarefa = 'pendente' | 'concluida';

export interface Tarefa {
  id: string;
  tipo: TipoTarefa;
  descricao: string;
  dataAgendada: string;    // YYYY-MM-DD
  horaAgendada?: string;   // HH:MM, opcional
  responsavelId: string;
  origemTipo: 'seguro_novo' | 'renovacao' | 'prospeccao' | 'geral';
  origemId?: string;       // undefined quando origemTipo === 'geral'
  nomeCliente?: string;    // opcional para tarefas avulsas
  clienteId?: string;
  status: StatusTarefa;
  criadoEm: string;
  atualizadoEm: string;
}

export type TipoImportacao = 'renovacoes' | 'seguros_novos' | 'prospeccoes' | 'clientes';

export interface LinhaImportValida { linha: number; nome: string; detalhe?: string; clienteNovo?: boolean; }
export interface LinhaImportInvalida { linha: number; nome: string; motivo: string; }

export interface ImportacaoLote {
  id: string;
  tipo: TipoImportacao;
  nomeArquivo: string;
  totalImportados: number;
  totalRejeitados: number;
  /** IDs dos registros principais (renovações/seguros/prospecções/clientes) criados */
  idsSalvos: string[];
  /** IDs dos clientes criados automaticamente junto com a importação */
  idsClientesCriados: string[];
  criadoEm: string;
  criadoPor: string; // userId
  linhasValidas?: LinhaImportValida[];
  linhasInvalidas?: LinhaImportInvalida[];
}

export type GatilhoEmail =
  | 'aniversario'
  | 'seguro_novo_fechado'
  | 'seguro_renovado'
  | 'seguro_a_renovar'
  | 'seguro_nao_renovado'
  | 'massa'
  | 'manual';

/** Configuração de um gatilho de e-mail (gerenciável pelo admin) */
export interface ConfigGatilho {
  id: string;
  nome: string;
  descricao?: string;
  evento: GatilhoEmail;        // qual evento do sistema dispara
  modeloId?: string;           // ID do ModeloEmail associado
  ativo: boolean;
  diasAntecedencia?: number;   // apenas para evento 'seguro_a_renovar'
  criadoEm: string;
}

export interface ModeloEmail {
  id: string;
  nome: string;
  assunto: string;
  corpo: string;
  gatilho: GatilhoEmail;
  ativo: boolean;
  diasAntecedencia?: number; // only for 'seguro_a_renovar'
  criadoEm: string;
}

export interface EmailDisparo {
  id: string;
  modeloId: string;
  modeloNome: string;
  destinatarioEmail: string;
  destinatarioNome: string;
  assunto: string;
  corpo: string;
  status: 'pendente' | 'enviado' | 'erro';
  gatilho: GatilhoEmail;
  referenciaId?: string;
  criadoEm: string;
  enviadoEm?: string;
  erroMsg?: string;
}

// ─── Parcelas (Follow Up de Pagamentos) ──────────────────────────────────────

export type StatusParcela =
  | ''
  | 'nao_tratada'
  | 'em_tratamento'
  | 'baixada'
  | 'cancelado'
  | 'desconsiderado'
  | 'aguardando_baixa'
  | 'baixada_sistema'
  | 'analise_critica';

// ─── Automações de Parcelas ──────────────────────────────────────────────────

export type CampoParcela =
  | 'dias_apos_vencimento'   // (today - vencimento) in days, positive = overdue
  | 'dias_sem_import'        // (today - ultimaAtualizacao) in days
  | 'status'
  | 'seguradora'
  | 'ramo'
  | 'forma_pagamento'
  | 'valor_parcela';

export type OperadorCondicao =
  | 'igual'
  | 'diferente'
  | 'maior_que'
  | 'menor_que'
  | 'maior_igual'
  | 'menor_igual';

export interface CondicaoAutomacao {
  id: string;
  campo: CampoParcela;
  operador: OperadorCondicao;
  /** 'fixo' = valor literal; 'campo' = comparar com outro campo da parcela */
  tipoValor?: 'fixo' | 'campo';
  valor: string;
  /** Usado quando tipoValor === 'campo' */
  valorCampo?: CampoParcela;
}

export interface AutomacaoParcela {
  id: string;
  nome: string;
  ativo: boolean;
  /** 'padrao_vencimento' | 'padrao_sem_import' | 'personalizada' */
  tipo: 'padrao_vencimento' | 'padrao_sem_import' | 'personalizada';
  /** For padrao_vencimento: trigger after this many days past due date */
  diasAposVencimento?: number;
  /** For padrao_sem_import: parcela hasn't appeared in import AND vencimento is at least X days before import date */
  diasAntesSemImport?: number;
  /** For personalizada: list of conditions */
  condicoes: CondicaoAutomacao[];
  operadorLogico: 'E' | 'OU';
  /** Optional scope filters - empty string = any */
  filtroSeguradora: string;
  filtroRamo: string;
  /** The action: change status to this value */
  novoStatus: StatusParcela;
  /** Lower number = higher priority, executed first */
  prioridade: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Parcela {
  id: string;
  /** Chave única: apolice + "_" + numeroParcela */
  chaveUnica: string;
  /** Data em que a parcela apareceu pela 1ª vez no import (YYYY-MM-DD) */
  primeiraAtualizacao: string;
  /** Data do último import em que esta parcela apareceu (YYYY-MM-DD) */
  ultimaAtualizacao: string;
  nomeCliente: string;
  /** Vínculo opcional com cliente cadastrado */
  clienteId?: string;
  apolice: string;
  numeroParcela: string;
  /** Data de vencimento original (YYYY-MM-DD) */
  vencimento: string;
  valorParcela: number;
  seguradora: string;
  formaPagamento: string;
  /** Ramo do seguro (editável pelo operador) */
  ramo?: string;
  /** Editável pelo operador */
  status: StatusParcela;
  /** Data limite para pagamento (YYYY-MM-DD), editável pelo operador */
  dataLimite?: string;
  observacoes: Observacao[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface ImportacaoParcelas {
  id: string;
  nomeArquivo: string;
  /** Data extraída do nome do arquivo DD-MM-YYYY → YYYY-MM-DD */
  dataImport: string;
  /** Seguradoras que apareceram neste import */
  seguradorasConsideradas: string[];
  totalImportadas: number;
  totalNovas: number;
  totalAtualizadas: number;
  totalBaixadas: number;
  totalIgnoradas: number;
  linhasIgnoradas: { linha: number; motivo: string }[];
  criadoEm: string;
}

// ─── Regras de Negócio para Parcelas ─────────────────────────────────────────

export interface RegraParcelaNegocio {
  id: string;
  nome: string;
  /**
   * true  → regra padrão, aplica quando nenhuma regra específica corresponde.
   * false → regra específica, identificada pela combinação seguradora/ramo/formaPagamento.
   */
  isDefault: boolean;
  /** Vazio ("") = qualquer seguradora. Ignorado quando isDefault = true. */
  seguradora: string;
  /** Vazio ("") = qualquer ramo. Ignorado quando isDefault = true. */
  ramo: string;
  /** Vazio ("") = qualquer forma de pagamento. Ignorado quando isDefault = true. */
  formaPagamento: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}
