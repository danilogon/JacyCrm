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
  camposRestritos: {
    renovacoes: string[];
    segurosNovos: string[];
    prospeccoes: string[];
  };
  ativo: boolean;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senha: string;
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
  opcoes?: string[];
  multiplosArquivos?: boolean;
  tiposPermitidos?: string[];
  tamanhoMaximoMB?: number;
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
