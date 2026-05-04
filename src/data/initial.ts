import type {
  Usuario, Renovacao, SeguroNovo, Prospeccao, Cliente, Seguradora, Ramo,
  ConfiguracoesMetas, MotivoPerda, CampoCustomizavel, ConfiguracaoEmpresa,
  PlanoMetaRenovacao, PlanoMetaSeguroNovo, TipoUsuario,
} from '../types';

export const USUARIOS_INICIAIS: Usuario[] = [
  { id: 'u1', nome: 'João Silva', email: 'joao@empresa.com', senha: '123456', role: 'usuario', acessoRenovacoes: true, acessoSegurosNovos: true, recebeRemuneracaoRenovacoes: true, planoMetaRenovacaoId: 'pmr1', recebeRemuneracaoTaxaRenovacoes: true, recebeRemuneracaoAumentoComissao: true, recebeRemuneracaoSegurosNovos: true, planoMetaSeguroNovoId: 'pmsn1', recebeRemuneracaoSnComissao: true, recebeRemuneracaoSnTaxa: true, ativo: true },
  { id: 'u2', nome: 'Maria Santos', email: 'maria@empresa.com', senha: '123456', role: 'usuario', acessoRenovacoes: true, acessoSegurosNovos: false, recebeRemuneracaoRenovacoes: true, planoMetaRenovacaoId: 'pmr1', recebeRemuneracaoTaxaRenovacoes: true, recebeRemuneracaoAumentoComissao: false, recebeRemuneracaoSegurosNovos: false, recebeRemuneracaoSnComissao: false, recebeRemuneracaoSnTaxa: false, ativo: true },
  { id: 'u3', nome: 'Pedro Costa', email: 'pedro@empresa.com', senha: '123456', role: 'usuario', acessoRenovacoes: false, acessoSegurosNovos: true, recebeRemuneracaoRenovacoes: false, recebeRemuneracaoTaxaRenovacoes: false, recebeRemuneracaoAumentoComissao: false, recebeRemuneracaoSegurosNovos: false, recebeRemuneracaoSnComissao: false, recebeRemuneracaoSnTaxa: false, ativo: true },
  { id: 'u4', nome: 'Ana Oliveira', email: 'ana@empresa.com', senha: '123456', role: 'admin', acessoRenovacoes: true, acessoSegurosNovos: true, recebeRemuneracaoRenovacoes: true, planoMetaRenovacaoId: 'pmr1', recebeRemuneracaoTaxaRenovacoes: true, recebeRemuneracaoAumentoComissao: true, recebeRemuneracaoSegurosNovos: true, planoMetaSeguroNovoId: 'pmsn1', recebeRemuneracaoSnComissao: true, recebeRemuneracaoSnTaxa: true, ativo: true },
  { id: 'u5', nome: 'Carlos Gestor', email: 'carlos@empresa.com', senha: '123456', role: 'gestor', acessoRenovacoes: true, acessoSegurosNovos: true, recebeRemuneracaoRenovacoes: true, planoMetaRenovacaoId: 'pmr1', recebeRemuneracaoTaxaRenovacoes: true, recebeRemuneracaoAumentoComissao: true, recebeRemuneracaoSegurosNovos: true, planoMetaSeguroNovoId: 'pmsn1', recebeRemuneracaoSnComissao: true, recebeRemuneracaoSnTaxa: true, ativo: true },
];

export const SEGURADORAS_INICIAIS: Seguradora[] = [
  { id: 'seg01', nome: 'Akad',            ativo: true },
  { id: 'seg02', nome: 'Alfa',            ativo: true },
  { id: 'seg03', nome: 'Aliro',           ativo: true },
  { id: 'seg04', nome: 'Allianz',         ativo: true },
  { id: 'seg05', nome: 'Azul',            ativo: true },
  { id: 'seg06', nome: 'Azul Assinatura', ativo: true },
  { id: 'seg07', nome: 'Berkley',         ativo: true },
  { id: 'seg08', nome: 'Bradesco',        ativo: true },
  { id: 'seg09', nome: 'Chubb',           ativo: true },
  { id: 'seg10', nome: 'Darwin',          ativo: true },
  { id: 'seg11', nome: 'Essor',           ativo: true },
  { id: 'seg12', nome: 'Excelsior',       ativo: true },
  { id: 'seg13', nome: 'Ezze',            ativo: true },
  { id: 'seg14', nome: 'Fairfax',         ativo: true },
  { id: 'seg15', nome: 'HDI',             ativo: true },
  { id: 'seg16', nome: 'Itau',            ativo: true },
  { id: 'seg17', nome: 'Justos',          ativo: true },
  { id: 'seg18', nome: 'Mapfre',          ativo: true },
  { id: 'seg19', nome: 'Mitsui',          ativo: true },
  { id: 'seg20', nome: 'Novo',            ativo: true },
  { id: 'seg21', nome: 'Novo Seguros',    ativo: true },
  { id: 'seg22', nome: 'Pier',            ativo: true },
  { id: 'seg23', nome: 'Porto',           ativo: true },
  { id: 'seg24', nome: 'Sancor',          ativo: true },
  { id: 'seg25', nome: 'Sompo',           ativo: true },
  { id: 'seg26', nome: 'Suhai',           ativo: true },
  { id: 'seg27', nome: 'SulAmerica',      ativo: true },
  { id: 'seg28', nome: 'Sura',            ativo: true },
  { id: 'seg29', nome: 'Tokio',           ativo: true },
  { id: 'seg30', nome: 'Yellum',          ativo: true },
  { id: 'seg31', nome: 'Youse',           ativo: true },
  { id: 'seg32', nome: 'Zurich',          ativo: true },
];

export const RAMOS_INICIAIS: Ramo[] = [
  { id: 'r01', nome: 'Automovel',       ativo: true, tipoComissaoSegurosNovos: 'percentual', percentualComissao: 0,  valorFixo: 0,  considerarParaTaxaSegurosNovos: true,  considerarParaTaxaConversao: true,  remuneracaoIndividual: false },
  { id: 'r02', nome: 'Bike',            ativo: true, tipoComissaoSegurosNovos: 'percentual', percentualComissao: 25, valorFixo: 0,  considerarParaTaxaSegurosNovos: true,  considerarParaTaxaConversao: true,  remuneracaoIndividual: true  },
  { id: 'r03', nome: 'Cartão Porto',    ativo: true, tipoComissaoSegurosNovos: 'valor_fixo',  percentualComissao: 0,  valorFixo: 20, considerarParaTaxaSegurosNovos: false, considerarParaTaxaConversao: false, remuneracaoIndividual: true  },
  { id: 'r04', nome: 'Condomínio',      ativo: true, tipoComissaoSegurosNovos: 'percentual', percentualComissao: 25, valorFixo: 0,  considerarParaTaxaSegurosNovos: true,  considerarParaTaxaConversao: true,  remuneracaoIndividual: true  },
  { id: 'r05', nome: 'Empresarial',     ativo: true, tipoComissaoSegurosNovos: 'percentual', percentualComissao: 25, valorFixo: 0,  considerarParaTaxaSegurosNovos: true,  considerarParaTaxaConversao: true,  remuneracaoIndividual: true  },
  { id: 'r06', nome: 'RC Profissional', ativo: true, tipoComissaoSegurosNovos: 'percentual', percentualComissao: 25, valorFixo: 0,  considerarParaTaxaSegurosNovos: true,  considerarParaTaxaConversao: true,  remuneracaoIndividual: true  },
  { id: 'r07', nome: 'RD Equip',        ativo: true, tipoComissaoSegurosNovos: 'percentual', percentualComissao: 25, valorFixo: 0,  considerarParaTaxaSegurosNovos: true,  considerarParaTaxaConversao: true,  remuneracaoIndividual: true  },
  { id: 'r08', nome: 'Residencial',     ativo: true, tipoComissaoSegurosNovos: 'percentual', percentualComissao: 25, valorFixo: 0,  considerarParaTaxaSegurosNovos: true,  considerarParaTaxaConversao: true,  remuneracaoIndividual: true  },
  { id: 'r09', nome: 'Viagem',          ativo: true, tipoComissaoSegurosNovos: 'percentual', percentualComissao: 25, valorFixo: 0,  considerarParaTaxaSegurosNovos: true,  considerarParaTaxaConversao: true,  remuneracaoIndividual: true  },
  { id: 'r10', nome: 'Vida AP',         ativo: true, tipoComissaoSegurosNovos: 'percentual', percentualComissao: 25, valorFixo: 0,  considerarParaTaxaSegurosNovos: true,  considerarParaTaxaConversao: true,  remuneracaoIndividual: true  },
  { id: 'r11', nome: 'Vida Individual', ativo: true, tipoComissaoSegurosNovos: 'percentual', percentualComissao: 80, valorFixo: 0,  considerarParaTaxaSegurosNovos: true,  considerarParaTaxaConversao: true,  remuneracaoIndividual: true  },
  { id: 'r12', nome: 'Vida PME',        ativo: true, tipoComissaoSegurosNovos: 'percentual', percentualComissao: 80, valorFixo: 0,  considerarParaTaxaSegurosNovos: true,  considerarParaTaxaConversao: true,  remuneracaoIndividual: true  },
];

export const MOTIVOS_PERDA_RENOVACAO: MotivoPerda[] = [
  { id: 'mr1', nome: 'Cliente não renovou por preço', tipo: 'renovacao', ativo: true, ordem: 1, considerarTaxaConversaoRenovacoes: true, considerarTaxaConversaoSegurosNovos: false, considerarCalculoMetas: true, geraProspeccao: true },
  { id: 'mr2', nome: 'Cliente mudou de seguradora', tipo: 'renovacao', ativo: true, ordem: 2, considerarTaxaConversaoRenovacoes: true, considerarTaxaConversaoSegurosNovos: false, considerarCalculoMetas: true, geraProspeccao: true },
  { id: 'mr3', nome: 'Cliente cancelou o seguro', tipo: 'renovacao', ativo: true, ordem: 3, considerarTaxaConversaoRenovacoes: true, considerarTaxaConversaoSegurosNovos: false, considerarCalculoMetas: true, geraProspeccao: false },
  { id: 'mr4', nome: 'Não conseguimos contato', tipo: 'renovacao', ativo: true, ordem: 4, considerarTaxaConversaoRenovacoes: true, considerarTaxaConversaoSegurosNovos: false, considerarCalculoMetas: true, geraProspeccao: true },
  { id: 'mr5', nome: 'Cliente insatisfeito com atendimento', tipo: 'renovacao', ativo: true, ordem: 5, considerarTaxaConversaoRenovacoes: true, considerarTaxaConversaoSegurosNovos: false, considerarCalculoMetas: true, geraProspeccao: false },
  { id: 'mr6', nome: 'Apenas simulação/consulta', tipo: 'renovacao', ativo: true, ordem: 6, considerarTaxaConversaoRenovacoes: false, considerarTaxaConversaoSegurosNovos: false, considerarCalculoMetas: false, geraProspeccao: false },
  { id: 'mr7', nome: 'Outros motivos', tipo: 'renovacao', ativo: true, ordem: 7, considerarTaxaConversaoRenovacoes: true, considerarTaxaConversaoSegurosNovos: false, considerarCalculoMetas: true, geraProspeccao: true },
];

export const MOTIVOS_PERDA_PROSPECCAO: MotivoPerda[] = [
  { id: 'mp1', nome: 'Sem interesse no momento', tipo: 'prospeccao', ativo: true, ordem: 1, considerarTaxaConversaoRenovacoes: false, considerarTaxaConversaoSegurosNovos: false, considerarCalculoMetas: false, geraProspeccao: false },
  { id: 'mp2', nome: 'Já possui seguro com outro corretor', tipo: 'prospeccao', ativo: true, ordem: 2, considerarTaxaConversaoRenovacoes: false, considerarTaxaConversaoSegurosNovos: false, considerarCalculoMetas: false, geraProspeccao: false },
  { id: 'mp3', nome: 'Preço não competitivo', tipo: 'prospeccao', ativo: true, ordem: 3, considerarTaxaConversaoRenovacoes: false, considerarTaxaConversaoSegurosNovos: false, considerarCalculoMetas: false, geraProspeccao: false },
  { id: 'mp4', nome: 'Sem contato / não respondeu', tipo: 'prospeccao', ativo: true, ordem: 4, considerarTaxaConversaoRenovacoes: false, considerarTaxaConversaoSegurosNovos: false, considerarCalculoMetas: false, geraProspeccao: false },
  { id: 'mp5', nome: 'Outros motivos', tipo: 'prospeccao', ativo: true, ordem: 5, considerarTaxaConversaoRenovacoes: false, considerarTaxaConversaoSegurosNovos: false, considerarCalculoMetas: false, geraProspeccao: false },
];

export const MOTIVOS_PERDA_SEGURO_NOVO: MotivoPerda[] = [
  { id: 'ms1', nome: 'Preço não competitivo', tipo: 'seguro_novo', ativo: true, ordem: 1, considerarTaxaConversaoRenovacoes: false, considerarTaxaConversaoSegurosNovos: true, considerarCalculoMetas: true, geraProspeccao: true },
  { id: 'ms2', nome: 'Cliente desistiu da contratação', tipo: 'seguro_novo', ativo: true, ordem: 2, considerarTaxaConversaoRenovacoes: false, considerarTaxaConversaoSegurosNovos: true, considerarCalculoMetas: true, geraProspeccao: false },
  { id: 'ms3', nome: 'Documentação incompleta', tipo: 'seguro_novo', ativo: true, ordem: 3, considerarTaxaConversaoRenovacoes: false, considerarTaxaConversaoSegurosNovos: true, considerarCalculoMetas: true, geraProspeccao: true },
  { id: 'ms4', nome: 'Cliente escolheu outro corretor', tipo: 'seguro_novo', ativo: true, ordem: 4, considerarTaxaConversaoRenovacoes: false, considerarTaxaConversaoSegurosNovos: true, considerarCalculoMetas: true, geraProspeccao: true },
  { id: 'ms5', nome: 'Não aprovado pela seguradora', tipo: 'seguro_novo', ativo: true, ordem: 5, considerarTaxaConversaoRenovacoes: false, considerarTaxaConversaoSegurosNovos: true, considerarCalculoMetas: true, geraProspeccao: false },
  { id: 'ms6', nome: 'Cliente não respondeu', tipo: 'seguro_novo', ativo: true, ordem: 6, considerarTaxaConversaoRenovacoes: false, considerarTaxaConversaoSegurosNovos: true, considerarCalculoMetas: true, geraProspeccao: true },
  { id: 'ms7', nome: 'Apenas cotação/simulação', tipo: 'seguro_novo', ativo: true, ordem: 7, considerarTaxaConversaoRenovacoes: false, considerarTaxaConversaoSegurosNovos: false, considerarCalculoMetas: false, geraProspeccao: false },
  { id: 'ms8', nome: 'Cliente teste interno', tipo: 'seguro_novo', ativo: true, ordem: 8, considerarTaxaConversaoRenovacoes: false, considerarTaxaConversaoSegurosNovos: false, considerarCalculoMetas: false, geraProspeccao: false },
  { id: 'ms9', nome: 'Outros motivos', tipo: 'seguro_novo', ativo: true, ordem: 9, considerarTaxaConversaoRenovacoes: false, considerarTaxaConversaoSegurosNovos: true, considerarCalculoMetas: true, geraProspeccao: true },
];

export const PLANO_META_RENOVACAO_PADRAO: PlanoMetaRenovacao = {
  id: 'pmr1',
  nome: 'Plano Padrão',
  considerarSnNaTaxa: true,
  taxaConversaoRenovacoes: [
    { id: 'tcr1', minimo: 0, maximo: 90, tipo: 'percentual', valor: 3 },
    { id: 'tcr2', minimo: 90.01, maximo: 95, tipo: 'percentual', valor: 4 },
    { id: 'tcr3', minimo: 95.01, maximo: null, tipo: 'valor_fixo', valor: 500 },
  ],
  aumentoComissao: [
    { id: 'ac1', minimo: 10, maximo: 14.99, tipo: 'percentual', valor: 1 },
    { id: 'ac2', minimo: 15, maximo: 19.99, tipo: 'percentual', valor: 1.5 },
    { id: 'ac3', minimo: 20, maximo: null, tipo: 'valor_fixo', valor: 300 },
  ],
};

export const PLANO_META_SEGURO_NOVO_PADRAO: PlanoMetaSeguroNovo = {
  id: 'pmsn1',
  nome: 'Plano Padrão',
  segurosNovosPorComissao: [
    { id: 'snc1', minimo: 5000, maximo: 9999.99, tipo: 'percentual', valor: 2 },
    { id: 'snc2', minimo: 10000, maximo: null, tipo: 'valor_fixo', valor: 800 },
  ],
  segurosNovosPorTaxa: [
    { id: 'snt1', minimo: 80, maximo: 89.99, tipo: 'percentual', valor: 3 },
    { id: 'snt2', minimo: 90, maximo: null, tipo: 'valor_fixo', valor: 600 },
  ],
};

export const METAS_INICIAIS: ConfiguracoesMetas = {
  planosRenovacao: [PLANO_META_RENOVACAO_PADRAO],
  planosSeguroNovo: [PLANO_META_SEGURO_NOVO_PADRAO],
};

export const CAMPOS_CUSTOMIZAVEIS_INICIAIS: CampoCustomizavel[] = [
  { id: 'cc1', nome: 'Número da Apólice', tipo: 'texto', obrigatorio: false, ativo: true, aplicavelA: 'ambos' },
  { id: 'cc2', nome: 'Data de Vistoria', tipo: 'data', obrigatorio: false, ativo: true, aplicavelA: 'seguros_novos' },
  { id: 'cc3', nome: 'Forma de Pagamento', tipo: 'lista', obrigatorio: true, ativo: true, aplicavelA: 'ambos', opcoes: ['À Vista', 'Parcelado 2x', 'Parcelado 3x', 'Parcelado 6x', 'Parcelado 12x'] },
  { id: 'cc4', nome: 'Documentos do Veículo', tipo: 'arquivo', obrigatorio: false, ativo: true, aplicavelA: 'seguros_novos', multiplosArquivos: true, tiposPermitidos: ['.pdf', '.jpg', '.png'], tamanhoMaximoMB: 10 },
  { id: 'cc5', nome: 'Comprovante de Pagamento', tipo: 'arquivo', obrigatorio: false, ativo: true, aplicavelA: 'ambos', multiplosArquivos: false, tiposPermitidos: ['.pdf', '.jpg', '.png'], tamanhoMaximoMB: 5 },
];

export const TIPOS_USUARIO_INICIAIS: TipoUsuario[] = [
  {
    id: 'tu1', nome: 'Administrador', descricao: 'Acesso total ao sistema, incluindo configurações e usuários.', role: 'admin',
    acessoRenovacoes: true, acessoSegurosNovos: true, acessoProspeccao: true, podeDescartarProspeccao: true,
    visualizarDashboard: true, visualizarProducao: true, visualizarMetas: true, visualizarComissoes: true,
    camposRestritos: { renovacoes: [], segurosNovos: [], prospeccoes: [] },
    ativo: true,
  },
  {
    id: 'tu2', nome: 'Gestor', descricao: 'Visualiza e gerencia toda a produção da equipe, sem acesso a configurações.', role: 'gestor',
    acessoRenovacoes: true, acessoSegurosNovos: true, acessoProspeccao: true, podeDescartarProspeccao: true,
    visualizarDashboard: true, visualizarProducao: true, visualizarMetas: true, visualizarComissoes: false,
    camposRestritos: { renovacoes: [], segurosNovos: [], prospeccoes: [] },
    ativo: true,
  },
  {
    id: 'tu3', nome: 'Corretor', descricao: 'Acesso à sua própria produção de renovações e seguros novos, com metas e remuneração.', role: 'usuario',
    acessoRenovacoes: true, acessoSegurosNovos: true, acessoProspeccao: true, podeDescartarProspeccao: false,
    visualizarDashboard: true, visualizarProducao: false, visualizarMetas: true, visualizarComissoes: false,
    camposRestritos: { renovacoes: [], segurosNovos: [], prospeccoes: [] },
    ativo: true,
  },
  {
    id: 'tu4', nome: 'Assistente', descricao: 'Acesso apenas à carteira de renovações, sem remuneração por metas.', role: 'usuario',
    acessoRenovacoes: true, acessoSegurosNovos: false, acessoProspeccao: false, podeDescartarProspeccao: false,
    visualizarDashboard: true, visualizarProducao: false, visualizarMetas: false, visualizarComissoes: false,
    camposRestritos: { renovacoes: [], segurosNovos: [], prospeccoes: [] },
    ativo: true,
  },
];

export const EMPRESA_INICIAL: ConfiguracaoEmpresa = {
  nome: 'Segura Mais',
  logoUrl: '',
  corPrimaria: '#1e40af',
  corSecundaria: '#1d4ed8',
};

export const CLIENTES_INICIAIS: Cliente[] = [
  { id: 'cl1', cpfCnpj: '12345678901', tipo: 'PF', nome: 'Roberto Almeida', email: 'roberto@email.com', telefone: '11999990001', dataNascimento: '1980-05-15', cep: '01310100', logradouro: 'Av. Paulista', numero: '1000', complemento: 'Apto 10', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP', criadoEm: '2024-01-01T00:00:00.000Z', atualizadoEm: '2024-01-01T00:00:00.000Z' },
  { id: 'cl2', cpfCnpj: '98765432100', tipo: 'PF', nome: 'Fernanda Lima', email: 'fernanda@email.com', telefone: '11999990002', dataNascimento: '1990-08-20', cep: '04538132', logradouro: 'Av. Brigadeiro Faria Lima', numero: '2000', complemento: '', bairro: 'Itaim Bibi', cidade: 'São Paulo', uf: 'SP', criadoEm: '2024-01-02T00:00:00.000Z', atualizadoEm: '2024-01-02T00:00:00.000Z' },
  { id: 'cl3', cpfCnpj: '11122233344', tipo: 'PF', nome: 'Carlos Mendes', email: 'carlos@email.com', telefone: '11999990003', dataNascimento: '1975-03-10', cep: '20040020', logradouro: 'Av. Rio Branco', numero: '156', complemento: 'Sala 5', bairro: 'Centro', cidade: 'Rio de Janeiro', uf: 'RJ', criadoEm: '2024-01-03T00:00:00.000Z', atualizadoEm: '2024-01-03T00:00:00.000Z' },
  { id: 'cl4', cpfCnpj: '12345678000195', tipo: 'PJ', nome: 'Tech Solutions Ltda', email: 'contato@techsolutions.com', telefone: '11999990004', cep: '04711130', logradouro: 'Av. das Nações Unidas', numero: '12901', complemento: 'Andar 15', bairro: 'Brooklin', cidade: 'São Paulo', uf: 'SP', criadoEm: '2024-01-04T00:00:00.000Z', atualizadoEm: '2024-01-04T00:00:00.000Z' },
  { id: 'cl5', cpfCnpj: '98765432000188', tipo: 'PJ', nome: 'Comércio Bom Preço S/A', email: 'financeiro@bompreco.com', telefone: '11999990005', cep: '30130170', logradouro: 'Av. Afonso Pena', numero: '867', complemento: '', bairro: 'Centro', cidade: 'Belo Horizonte', uf: 'MG', criadoEm: '2024-01-05T00:00:00.000Z', atualizadoEm: '2024-01-05T00:00:00.000Z' },
];

export const RENOVACOES_INICIAIS: Renovacao[] = [
  { id: 'rv1', responsavelId: 'u1', clienteId: 'cl1', nomeCliente: 'Roberto Almeida', emailCliente: 'roberto@email.com', telefoneCliente: '11999990001', cpfCnpjCliente: '12345678901', fimVigencia: '2026-05-10', ramo: 'Auto', seguradoraAnterior: 'Porto Seguro', premioAnterior: 2000, percentComissaoAnterior: 10, comissaoAnterior: 200, seguradoraNova: 'Allianz', premioNovo: 1900, percentComissaoNova: 12, comissaoNova: 228, resultado: 28, status: 'renovado', observacoes: [], camposCustomizados: [], criadoEm: '2026-04-15T00:00:00.000Z', atualizadoEm: '2026-05-02T00:00:00.000Z' },
  { id: 'rv2', responsavelId: 'u1', clienteId: 'cl2', nomeCliente: 'Fernanda Lima', emailCliente: 'fernanda@email.com', telefoneCliente: '11999990002', cpfCnpjCliente: '98765432100', fimVigencia: '2026-05-20', ramo: 'Residencial', seguradoraAnterior: 'Bradesco Seguros', premioAnterior: 1500, percentComissaoAnterior: 15, comissaoAnterior: 225, seguradoraNova: 'SulAmérica', premioNovo: 1600, percentComissaoNova: 15, comissaoNova: 240, resultado: 15, status: 'renovado', observacoes: [], camposCustomizados: [], criadoEm: '2026-04-20T00:00:00.000Z', atualizadoEm: '2026-05-01T00:00:00.000Z' },
  { id: 'rv3', responsavelId: 'u2', clienteId: 'cl3', nomeCliente: 'Carlos Mendes', emailCliente: 'carlos@email.com', telefoneCliente: '11999990003', cpfCnpjCliente: '11122233344', fimVigencia: '2026-05-05', ramo: 'Vida', seguradoraAnterior: 'SulAmérica', premioAnterior: 800, percentComissaoAnterior: 20, comissaoAnterior: 160, seguradoraNova: '', premioNovo: 0, percentComissaoNova: 0, comissaoNova: 0, resultado: 0, status: 'a_trabalhar', observacoes: [], camposCustomizados: [], criadoEm: '2026-04-10T00:00:00.000Z', atualizadoEm: '2026-04-10T00:00:00.000Z' },
  { id: 'rv4', responsavelId: 'u2', clienteId: 'cl4', nomeCliente: 'Tech Solutions Ltda', emailCliente: 'contato@techsolutions.com', telefoneCliente: '11999990004', cpfCnpjCliente: '12345678000195', fimVigencia: '2026-05-12', ramo: 'Empresarial', seguradoraAnterior: 'Mapfre', premioAnterior: 5000, percentComissaoAnterior: 8, comissaoAnterior: 400, seguradoraNova: 'Porto Seguro', premioNovo: 4800, percentComissaoNova: 10, comissaoNova: 480, resultado: 80, status: 'pendente', observacoes: [], camposCustomizados: [], criadoEm: '2026-04-15T00:00:00.000Z', atualizadoEm: '2026-04-15T00:00:00.000Z' },
  { id: 'rv5', responsavelId: 'u1', clienteId: 'cl5', nomeCliente: 'Comércio Bom Preço S/A', emailCliente: 'financeiro@bompreco.com', telefoneCliente: '11999990005', cpfCnpjCliente: '98765432000188', fimVigencia: '2026-05-18', ramo: 'Auto', seguradoraAnterior: 'Itaú Seguros', premioAnterior: 3200, percentComissaoAnterior: 10, comissaoAnterior: 320, seguradoraNova: '', premioNovo: 0, percentComissaoNova: 0, comissaoNova: 0, resultado: 0, status: 'em_orcamento', observacoes: [], camposCustomizados: [], criadoEm: '2026-04-20T00:00:00.000Z', atualizadoEm: '2026-04-20T00:00:00.000Z' },
  { id: 'rv6', responsavelId: 'u1', nomeCliente: 'Paulo Rodrigues', emailCliente: 'paulo@email.com', telefoneCliente: '11999990006', cpfCnpjCliente: '55566677788', fimVigencia: '2026-05-25', ramo: 'Saúde', seguradoraAnterior: 'Allianz', premioAnterior: 1200, percentComissaoAnterior: 15, comissaoAnterior: 180, seguradoraNova: '', premioNovo: 0, percentComissaoNova: 0, comissaoNova: 0, resultado: 0, status: 'a_trabalhar', observacoes: [], camposCustomizados: [], criadoEm: '2026-04-25T00:00:00.000Z', atualizadoEm: '2026-04-25T00:00:00.000Z' },
];

export const PROSPECCOES_INICIAIS: Prospeccao[] = [
  // ── Prospecções abertas (ainda não assumidas) ─────────────────────────────────
  {
    id: 'pr1', origem: 'manual', responsavelId: 'u4',
    clienteId: 'cl1', nomeCliente: 'Roberto Almeida', emailCliente: 'roberto@email.com',
    telefoneCliente: '11999990001', cpfCnpjCliente: '12345678901',
    ramo: 'Auto', seguradora: 'Allianz', premioReferencia: 2200,
    dataContato: '2026-05-02', status: 'a_contatar',
    observacoes: [], camposCustomizados: [],
    criadoEm: '2026-05-02T09:00:00.000Z', atualizadoEm: '2026-05-02T09:00:00.000Z',
  },
  {
    id: 'pr3', origem: 'seguro_novo_perdido', responsavelId: 'u4',
    clienteId: 'cl2', nomeCliente: 'Fernanda Lima', emailCliente: 'fernanda@email.com',
    telefoneCliente: '11999990002', cpfCnpjCliente: '98765432100',
    ramo: 'Residencial', seguradora: 'SulAmérica', premioReferencia: 1600,
    dataContato: '2026-05-03', status: 'em_contato',
    observacoes: [], camposCustomizados: [],
    criadoEm: '2026-05-03T10:00:00.000Z', atualizadoEm: '2026-05-04T11:00:00.000Z',
  },
  {
    id: 'pr4', origem: 'manual', responsavelId: 'u5',
    nomeCliente: 'Marcos Vieira', emailCliente: 'marcos@email.com',
    telefoneCliente: '11988880001', cpfCnpjCliente: '66677788899',
    ramo: 'Empresarial', seguradora: 'Mapfre', premioReferencia: 5500,
    dataContato: '2026-05-05', status: 'proposta_enviada',
    observacoes: [], camposCustomizados: [],
    criadoEm: '2026-05-05T14:00:00.000Z', atualizadoEm: '2026-05-06T08:30:00.000Z',
  },
  {
    id: 'pr8', origem: 'manual', responsavelId: 'u4',
    nomeCliente: 'Rafael Nunes', emailCliente: 'rafael@email.com',
    telefoneCliente: '11977770002', cpfCnpjCliente: '55544433322',
    ramo: 'Auto', seguradora: 'Porto Seguro', premioReferencia: 3000,
    dataContato: '2026-05-10', status: 'a_contatar',
    observacoes: [], camposCustomizados: [],
    criadoEm: '2026-05-10T15:00:00.000Z', atualizadoEm: '2026-05-10T15:00:00.000Z',
  },

  // ── Prospecções vencidas não trabalhadas ──────────────────────────────────────
  {
    id: 'pr5', origem: 'renovacao_perdida', responsavelId: 'u4',
    clienteId: 'cl5', nomeCliente: 'Comércio Bom Preço S/A', emailCliente: 'financeiro@bompreco.com',
    telefoneCliente: '11999990005', cpfCnpjCliente: '98765432000188',
    ramo: 'Auto', seguradora: 'Porto Seguro', premioReferencia: 3200,
    dataContato: '2026-04-28', status: 'a_contatar',
    observacoes: [], camposCustomizados: [],
    criadoEm: '2026-04-28T00:00:00.000Z', atualizadoEm: '2026-04-28T00:00:00.000Z',
  },
  {
    id: 'pr7', origem: 'seguro_novo_perdido', responsavelId: 'u4',
    clienteId: 'cl4', nomeCliente: 'Tech Solutions Ltda', emailCliente: 'contato@techsolutions.com',
    telefoneCliente: '11999990004', cpfCnpjCliente: '12345678000195',
    ramo: 'Empresarial', seguradora: 'Itaú Seguros', premioReferencia: 7000,
    dataContato: '2026-04-30', status: 'a_contatar',
    observacoes: [], camposCustomizados: [],
    criadoEm: '2026-04-30T00:00:00.000Z', atualizadoEm: '2026-04-30T00:00:00.000Z',
  },

  // ── Prospecções já assumidas (convertidas para Seguros Novos) ─────────────────
  {
    id: 'pr2', origem: 'renovacao_perdida', responsavelId: 'u4',
    clienteId: 'cl3', nomeCliente: 'Carlos Mendes', emailCliente: 'carlos@email.com',
    telefoneCliente: '11999990003', cpfCnpjCliente: '11122233344',
    ramo: 'Vida', seguradora: 'SulAmérica', premioReferencia: 800,
    dataContato: '2026-05-01', status: 'convertido',
    assumidoPor: 'u1', assumidoEm: '2026-05-03T10:30:00.000Z', seguroNovoId: 'sn-pr2',
    observacoes: [], camposCustomizados: [],
    criadoEm: '2026-05-01T00:00:00.000Z', atualizadoEm: '2026-05-03T10:30:00.000Z',
  },
  {
    id: 'pr6', origem: 'manual', responsavelId: 'u5',
    nomeCliente: 'Sofia Pereira', emailCliente: 'sofia@email.com',
    telefoneCliente: '11966660003', cpfCnpjCliente: '99988877766',
    ramo: 'Saúde', seguradora: 'Bradesco Seguros', premioReferencia: 1400,
    dataContato: '2026-05-07', status: 'convertido',
    assumidoPor: 'u3', assumidoEm: '2026-05-08T09:00:00.000Z', seguroNovoId: 'sn-pr6',
    observacoes: [], camposCustomizados: [],
    criadoEm: '2026-05-07T00:00:00.000Z', atualizadoEm: '2026-05-08T09:00:00.000Z',
  },
  {
    id: 'pr9', origem: 'renovacao_perdida', responsavelId: 'u4',
    clienteId: 'cl2', nomeCliente: 'Fernanda Lima', emailCliente: 'fernanda@email.com',
    telefoneCliente: '11999990002', cpfCnpjCliente: '98765432100',
    ramo: 'Auto', seguradora: 'Allianz', premioReferencia: 2800,
    dataContato: '2026-05-12', status: 'convertido',
    assumidoPor: 'u1', assumidoEm: '2026-05-13T11:00:00.000Z', seguroNovoId: 'sn-pr9',
    observacoes: [], camposCustomizados: [],
    criadoEm: '2026-05-12T00:00:00.000Z', atualizadoEm: '2026-05-13T11:00:00.000Z',
  },
  {
    id: 'pr11', origem: 'manual', responsavelId: 'u5',
    nomeCliente: 'Juliana Castro', emailCliente: 'juliana@email.com',
    telefoneCliente: '11955550004', cpfCnpjCliente: '33322211100',
    ramo: 'Vida', seguradora: 'SulAmérica', premioReferencia: 950,
    dataContato: '2026-05-06', status: 'convertido',
    assumidoPor: 'u2', assumidoEm: '2026-05-07T14:00:00.000Z', seguroNovoId: 'sn-pr11',
    observacoes: [], camposCustomizados: [],
    criadoEm: '2026-05-06T00:00:00.000Z', atualizadoEm: '2026-05-07T14:00:00.000Z',
  },

  // ── Prospecção descartada ────────────────────────────────────────────────────
  {
    id: 'pr10', origem: 'manual', responsavelId: 'u4',
    clienteId: 'cl3', nomeCliente: 'Carlos Mendes', emailCliente: 'carlos@email.com',
    telefoneCliente: '11999990003', cpfCnpjCliente: '11122233344',
    ramo: 'Residencial', seguradora: 'Mapfre', premioReferencia: 1100,
    dataContato: '2026-04-25', status: 'descartado', motivoPerdaId: 'mp1',
    observacoes: [], camposCustomizados: [],
    criadoEm: '2026-04-25T00:00:00.000Z', atualizadoEm: '2026-04-29T16:00:00.000Z',
  },
];

export const SEGUROS_NOVOS_INICIAIS: SeguroNovo[] = [
  { id: 'sn1', responsavelId: 'u1', clienteId: 'cl1', nomeCliente: 'Roberto Almeida', emailCliente: 'roberto@email.com', telefoneCliente: '11999990001', cpfCnpjCliente: '12345678901', inicioVigencia: '2026-05-05', ramo: 'Auto', seguradora: 'Porto Seguro', premioLiquido: 2500, percentComissao: 10, comissao: 250, comissaoAReceber: 125, status: 'fechado', observacoes: [], camposCustomizados: [], criadoEm: '2026-04-28T00:00:00.000Z', atualizadoEm: '2026-05-05T00:00:00.000Z' },
  { id: 'sn2', responsavelId: 'u3', nomeCliente: 'André Souza', emailCliente: 'andre@email.com', telefoneCliente: '11999990007', cpfCnpjCliente: '44455566677', inicioVigencia: '2026-05-15', ramo: 'Residencial', seguradora: 'Bradesco Seguros', premioLiquido: 1800, percentComissao: 15, comissao: 270, comissaoAReceber: 135, status: 'em_negociacao', observacoes: [], camposCustomizados: [], criadoEm: '2026-05-01T00:00:00.000Z', atualizadoEm: '2026-05-01T00:00:00.000Z' },
  { id: 'sn3', responsavelId: 'u3', nomeCliente: 'Beatriz Costa', emailCliente: 'beatriz@email.com', telefoneCliente: '11999990008', cpfCnpjCliente: '77788899900', inicioVigencia: '2026-05-22', ramo: 'Vida', seguradora: 'SulAmérica', premioLiquido: 600, percentComissao: 20, comissao: 120, comissaoAReceber: 60, status: 'perdido', motivoPerdaId: 'ms1', observacoes: [], camposCustomizados: [], criadoEm: '2026-05-02T00:00:00.000Z', atualizadoEm: '2026-05-02T00:00:00.000Z' },
  { id: 'sn4', responsavelId: 'u1', clienteId: 'cl4', nomeCliente: 'Tech Solutions Ltda', emailCliente: 'contato@techsolutions.com', telefoneCliente: '11999990004', cpfCnpjCliente: '12345678000195', inicioVigencia: '2026-05-08', ramo: 'Empresarial', seguradora: 'Mapfre', premioLiquido: 8000, percentComissao: 8, comissao: 640, comissaoAReceber: 320, status: 'fechado', observacoes: [], camposCustomizados: [], criadoEm: '2026-04-25T00:00:00.000Z', atualizadoEm: '2026-05-08T00:00:00.000Z' },
  { id: 'sn5', responsavelId: 'u3', nomeCliente: 'Diego Martins', emailCliente: 'diego@email.com', telefoneCliente: '11999990009', cpfCnpjCliente: '33344455566', inicioVigencia: '2026-05-12', ramo: 'Viagem', seguradora: 'Allianz', premioLiquido: 300, percentComissao: 20, comissao: 60, comissaoAReceber: 50, status: 'fechado', observacoes: [], camposCustomizados: [], criadoEm: '2026-05-01T00:00:00.000Z', atualizadoEm: '2026-05-12T00:00:00.000Z' },
  { id: 'sn6', responsavelId: 'u1', nomeCliente: 'Luciana Ferreira', emailCliente: 'luciana@email.com', telefoneCliente: '11999990010', cpfCnpjCliente: '22233344455', inicioVigencia: '2026-05-20', ramo: 'Saúde', seguradora: 'Itaú Seguros', premioLiquido: 1200, percentComissao: 15, comissao: 180, comissaoAReceber: 90, status: 'a_trabalhar', observacoes: [], camposCustomizados: [], criadoEm: '2026-05-02T00:00:00.000Z', atualizadoEm: '2026-05-02T00:00:00.000Z' },
  // Seguros Novos originados de prospecções assumidas
  { id: 'sn-pr2', responsavelId: 'u1', clienteId: 'cl3', nomeCliente: 'Carlos Mendes', emailCliente: 'carlos@email.com', telefoneCliente: '11999990003', cpfCnpjCliente: '11122233344', inicioVigencia: '2026-05-15', ramo: 'Vida', seguradora: 'SulAmérica', premioLiquido: 800, percentComissao: 20, comissao: 160, comissaoAReceber: 80, status: 'em_negociacao', origemProspeccaoId: 'pr2', observacoes: [], camposCustomizados: [], criadoEm: '2026-05-03T10:30:00.000Z', atualizadoEm: '2026-05-03T10:30:00.000Z' },
  { id: 'sn-pr6', responsavelId: 'u3', nomeCliente: 'Sofia Pereira', emailCliente: 'sofia@email.com', telefoneCliente: '11966660003', cpfCnpjCliente: '99988877766', inicioVigencia: '2026-05-20', ramo: 'Saúde', seguradora: 'Bradesco Seguros', premioLiquido: 1400, percentComissao: 15, comissao: 210, comissaoAReceber: 105, status: 'fechado', origemProspeccaoId: 'pr6', observacoes: [], camposCustomizados: [], criadoEm: '2026-05-08T09:00:00.000Z', atualizadoEm: '2026-05-08T09:00:00.000Z' },
  { id: 'sn-pr9', responsavelId: 'u1', clienteId: 'cl2', nomeCliente: 'Fernanda Lima', emailCliente: 'fernanda@email.com', telefoneCliente: '11999990002', cpfCnpjCliente: '98765432100', inicioVigencia: '2026-06-01', ramo: 'Auto', seguradora: 'Allianz', premioLiquido: 2800, percentComissao: 10, comissao: 280, comissaoAReceber: 140, status: 'a_trabalhar', origemProspeccaoId: 'pr9', observacoes: [], camposCustomizados: [], criadoEm: '2026-05-13T11:00:00.000Z', atualizadoEm: '2026-05-13T11:00:00.000Z' },
  { id: 'sn-pr11', responsavelId: 'u2', nomeCliente: 'Juliana Castro', emailCliente: 'juliana@email.com', telefoneCliente: '11955550004', cpfCnpjCliente: '33322211100', inicioVigencia: '2026-05-25', ramo: 'Vida', seguradora: 'SulAmérica', premioLiquido: 950, percentComissao: 20, comissao: 190, comissaoAReceber: 95, status: 'a_transmitir', origemProspeccaoId: 'pr11', observacoes: [], camposCustomizados: [], criadoEm: '2026-05-07T14:00:00.000Z', atualizadoEm: '2026-05-07T14:00:00.000Z' },
];
