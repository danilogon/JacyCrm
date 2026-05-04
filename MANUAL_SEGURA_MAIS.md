# Manual do Sistema — Segura Mais
> Versão 1.0 · Corretora de Seguros · Sistema de Gestão de Produção

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Autenticação e Perfis de Usuário](#2-autenticação-e-perfis-de-usuário)
3. [Cadastro de Usuários](#3-cadastro-de-usuários)
4. [Cadastro de Clientes](#4-cadastro-de-clientes)
5. [Configurações do Sistema](#5-configurações-do-sistema)
   - 5.1 Empresa
   - 5.2 Seguradoras
   - 5.3 Ramos
   - 5.4 Metas e Remunerações
   - 5.5 Motivos de Perda
   - 5.6 Campos Customizáveis
6. [Renovações](#6-renovações)
7. [Seguros Novos](#7-seguros-novos)
8. [Dashboard — Cálculos e Métricas](#8-dashboard--cálculos-e-métricas)

---

## 1. Visão Geral

O **Segura Mais** é um sistema SPA (Single Page Application) para gestão da produção de uma corretora de seguros. Todos os dados são armazenados no **localStorage** do navegador — não há servidor externo. Cada aba do navegador sincroniza os dados automaticamente.

### Módulos disponíveis

| Módulo | Descrição |
|---|---|
| Dashboard | Métricas consolidadas, taxas de conversão e metas do período |
| Renovações | Gestão do pipeline de renovações de apólices |
| Seguros Novos | Gestão do pipeline de novos negócios |
| Clientes | Cadastro e histórico de clientes (PF e PJ) |
| Usuários | Gestão de contas e permissões (somente admin) |
| Configurações | Parâmetros do sistema (somente admin) |

---

## 2. Autenticação e Perfis de Usuário

### Login

O acesso é feito por **email + senha**. Após o login, o sistema redireciona automaticamente de acordo com o perfil:

- **Admin** → Dashboard
- **Gestor** → Dashboard
- **Usuário** → Renovações ou Seguros Novos (conforme permissões configuradas)

### Perfis (roles)

| Perfil | Descrição | Acesso a Configurações | Acesso a Usuários | Pode ver todos os registros |
|---|---|---|---|---|
| **Administrador** | Controle total do sistema | ✓ | ✓ | ✓ |
| **Gestor** | Supervisão de equipe | ✗ | ✗ | ✓ |
| **Usuário** | Operador individual | ✗ | ✗ | Apenas os próprios |

> **Atenção:** Usuários com perfil `usuario` enxergam somente os registros onde estão marcados como **responsável**. Gestores e admins veem todos os registros e podem filtrar por responsável.

---

## 3. Cadastro de Usuários

> Acesso exclusivo para **Administradores**.

### Campos obrigatórios

| Campo | Regra |
|---|---|
| Nome | Obrigatório |
| Email | Obrigatório · deve ser único no sistema |
| Senha | Obrigatória apenas na criação · na edição, deixar em branco mantém a senha atual |
| Perfil | `Usuário`, `Gestor` ou `Administrador` |

### Permissões de Acesso

Estas flags controlam quais módulos o usuário pode acessar quando o perfil é `Usuário`:

| Flag | Efeito |
|---|---|
| **Acesso a Renovações** | Exibe o item "Renovações" na navegação e permite acessar o módulo |
| **Acesso a Seguros Novos** | Exibe o item "Seguros Novos" na navegação e permite acessar o módulo |

> Gestores e Admins **sempre** têm acesso a todos os módulos, independentemente dessas flags.

### Flags de Remuneração

Controlam se o usuário aparece no bloco de **Metas e Remunerações** do Dashboard:

| Flag | Efeito |
|---|---|
| **Recebe Remuneração Renovações** | O usuário é considerado nas metas de taxa de conversão e aumento de comissão de renovações |
| **Recebe Remuneração Seguros Novos** | O usuário é considerado nas metas de comissão e taxa de conversão de seguros novos |

> Usuários com perfil `usuario` só veem o bloco de Metas no Dashboard se tiverem ao menos uma das flags de remuneração ativa.

### Regras de validação

- Não é possível **desativar a própria conta** (o sistema impede com alerta).
- E-mails duplicados são bloqueados no momento de salvar.
- Usuários **inativos** continuam existindo no sistema mas não conseguem fazer login.

---

## 4. Cadastro de Clientes

### Tipo: PF ou PJ

O tipo é **detectado automaticamente** pelo número de dígitos do CPF/CNPJ:

| Dígitos (somente números) | Tipo detectado |
|---|---|
| 11 dígitos | **PF** — Pessoa Física |
| 14 dígitos | **PJ** — Pessoa Jurídica |
| Outro | Inválido — não salva |

> O campo "Data de Nascimento" só é exibido e salvo quando o tipo for **PF**.

### Validações de cadastro

| Campo | Regra |
|---|---|
| CPF/CNPJ | Obrigatório · dígitos inválidos bloqueiam o salvamento · duplicatas bloqueadas |
| Nome | Obrigatório |
| CEP | Busca automática via **ViaCEP API** ao sair do campo (preenchimento automático de logradouro, bairro, cidade e UF) |

### Busca automática de endereço (ViaCEP)

Ao digitar um CEP com 8 dígitos e sair do campo, o sistema consulta a API `viacep.com.br` e preenche automaticamente:
- Logradouro
- Bairro
- Cidade
- UF

Se o CEP não for encontrado, uma mensagem de erro é exibida abaixo do campo.

### Vinculação de clientes a registros

Clientes podem ser **vinculados** a Renovações e Seguros Novos:

- Na criação/edição de uma renovação ou seguro novo, há um campo de busca de cliente (por nome, CPF/CNPJ ou e-mail).
- Ao selecionar um cliente, seus dados (nome, email, telefone, CPF/CNPJ) são preenchidos automaticamente no registro.
- O vínculo armazena o `clienteId`. Os dados pessoais são copiados para o registro para manter **integridade histórica** (se o cliente for editado depois, os dados do registro anterior são preservados).
- Registros vinculados exibem o ícone **"Vinculado"** (✓) na tabela.

### Exclusão de clientes

Um cliente **não pode ser excluído** se estiver vinculado a qualquer renovação ou seguro novo. O sistema exibe um alerta bloqueando a operação.

### CSV de clientes (somente admin)

- **Exportar:** Gera arquivo com todos os clientes cadastrados.
- **Importar:** Aceita CSV com colunas: `CPF/CNPJ, Tipo, Nome, Email, Telefone, Data Nasc, CEP, Logradouro, Número, Complemento, Bairro, Cidade, UF`.

---

## 5. Configurações do Sistema

> Acesso exclusivo para **Administradores**.

### 5.1 Empresa

| Campo | Descrição |
|---|---|
| Nome da Empresa | Exibido na barra lateral |
| Cor Primária | Cor principal da interface (padrão: azul `#1e40af`) |
| Cor Secundária | Cor de destaque (padrão: azul `#1d4ed8`) |

As alterações são salvas automaticamente no localStorage.

---

### 5.2 Seguradoras

Cadastro de seguradoras disponíveis para seleção em renovações e seguros novos.

| Campo | Descrição |
|---|---|
| Nome | Nome da seguradora |
| Status (Ativa/Inativa) | Seguradoras inativas não aparecem nos formulários de criação/edição |

> Seguradoras podem ser excluídas diretamente. Não há bloqueio por uso em registros históricos.

---

### 5.3 Ramos

Os ramos definem como a comissão é calculada nos **Seguros Novos** e se os registros daquele ramo são considerados nas taxas de conversão do Dashboard.

#### Campos do ramo

| Campo | Descrição |
|---|---|
| Nome | Nome do ramo (ex.: Auto, Vida, Residencial) |
| Tipo de Comissão | Define como a `comissaoAReceber` é calculada nos seguros novos |
| Percentual (%) | Usado quando tipo = **Percentual** |
| Valor Fixo (R$) | Usado quando tipo = **Valor Fixo** |
| Considerar para Taxa de Seguros Novos | Se marcado, seguros deste ramo entram no cálculo da **Taxa de Conversão de Seguros Novos** |
| Considerar para Taxa de Conversão (Metas) | Se marcado, seguros novos fechados deste ramo somam ao numerador da **Taxa de Conversão de Renovações** |
| Ativo | Inativo = não aparece nos formulários |

#### Cálculo de Comissão a Receber — Seguros Novos

```
Se tipo = "Percentual":
  comissaoAReceber = comissão × (percentualComissao / 100)

Se tipo = "Valor Fixo":
  comissaoAReceber = valorFixo (valor fixo por seguro, independente do prêmio)
```

**Exemplo (ramo Auto — percentual 50%):**
- Prêmio: R$ 2.000 · % Comissão: 10% → Comissão = R$ 200
- comissaoAReceber = 200 × 50% = **R$ 100**

**Exemplo (ramo Viagem — valor fixo R$ 50):**
- Prêmio qualquer → comissaoAReceber = **R$ 50** (fixo)

---

### 5.4 Metas e Remunerações

Existem **4 grupos de metas**, cada um com uma ou mais **faixas**. Cada faixa define:

| Campo | Descrição |
|---|---|
| Mínimo | Valor mínimo do indicador para a faixa ser ativada |
| Máximo | Valor máximo da faixa (vazio = sem limite superior) |
| Tipo de Remuneração | `Percentual da comissão` ou `Valor Fixo (R$)` |
| Valor | Percentual ou valor fixo a receber ao atingir a faixa |

O sistema percorre as faixas em ordem e aplica a **primeira que contém o valor atual do indicador**. Só uma faixa é aplicada por vez.

#### Grupos de metas

| Grupo | Indicador avaliado | Base de cálculo (para tipo %) |
|---|---|---|
| **Taxa de Conversão de Renovações** | Taxa de conversão (%) | Comissão gerada em renovações |
| **Aumento de Comissão** | Percentual de aumento (%) | Comissão gerada em renovações |
| **Seguros Novos — Comissão Gerada** | Total de comissão em R$ | Comissão gerada em seguros novos |
| **Seguros Novos — Taxa de Conversão** | Taxa de conversão (%) | Comissão gerada em seguros novos |

#### Cálculo do bônus por faixa

```
Se tipo = "Percentual":
  bônus = baseDeCalculo × (valor / 100)

Se tipo = "Valor Fixo":
  bônus = valor (independente da comissão)
```

#### Status das faixas no Dashboard

| Badge | Significado |
|---|---|
| 🟢 **RECEBENDO** | O indicador atual está dentro dos limites desta faixa |
| 🔵 **Atingida** | O indicador está acima desta faixa (já foi superada) |
| 🟡 **Potencial** | O indicador ainda não chegou no mínimo desta faixa |
| ⚪ **Não atingida** | Faixa não alcançada no período |

---

### 5.5 Motivos de Perda

Cada motivo de perda possui 3 flags que determinam como os registros com aquele motivo impactam os cálculos:

| Flag | Impacto |
|---|---|
| **Considerar na Taxa de Conversão de Renovações** | Se marcado, registros `nao_renovada` com este motivo entram no **denominador** da taxa de conversão de renovações |
| **Considerar na Taxa de Conversão de Seguros Novos** | Se marcado, registros `perdido` com este motivo entram no **denominador** da taxa de conversão de seguros novos |
| **Considerar no cálculo de Metas** | Flag auxiliar para futuros relatórios — atualmente usada como alternativa em alguns contextos de cálculo |

> **Caso de uso típico:** Motivos como "Apenas simulação/consulta" ou "Cliente teste interno" ficam com todas as flags **desmarcadas**, para não penalizar as taxas de conversão com casos que não representam oportunidades reais.

#### Motivos disponíveis por tipo

- **Renovação:** Motivos de perda exibidos quando o status é `Não Renovada`
- **Seguro Novo:** Motivos de perda exibidos quando o status é `Perdido`

---

### 5.6 Campos Customizáveis

Permite criar campos adicionais nos formulários de Renovações e/ou Seguros Novos.

| Campo | Opções |
|---|---|
| Nome | Texto livre |
| Tipo | `Texto`, `Data`, `Lista (seleção)`, `Arquivo` |
| Obrigatório | Se marcado, o campo deve ser preenchido antes de salvar |
| Ativo | Inativo = não exibido nos formulários |
| Aplicável a | `Renovações`, `Seguros Novos` ou `Ambos` |
| Opções (tipo Lista) | Uma opção por linha |
| Múltiplos arquivos (tipo Arquivo) | Permite anexar mais de um arquivo |
| Tipos permitidos | Ex.: `.pdf`, `.jpg`, `.png` |
| Tamanho máximo | Em MB |

---

## 6. Renovações

### Pipeline de status

```
A Trabalhar → Em Orçamento → Em Negociação → A Transmitir → Pendente → Renovado
                                                                       ↘ Não Renovada
                                  Vencida (automático quando fimVigencia < hoje e status não final)
```

| Status | Descrição |
|---|---|
| A Trabalhar | Registro criado, ainda não iniciado |
| Em Orçamento | Proposta sendo elaborada |
| Em Negociação | Em tratativa com o cliente |
| A Transmitir | Aprovado, aguardando emissão |
| Pendente | Pendência documental ou de pagamento |
| **Renovado** | ✅ Negócio concluído — entra nas métricas do Dashboard |
| **Não Renovada** | ❌ Negócio perdido — requer seleção de Motivo de Perda |
| Vencida | ⚠️ Calculado automaticamente: `fimVigencia < hoje` AND status não é Renovado nem Não Renovada |

### Cálculo de Comissão nas Renovações

```
comissaoAnterior = premioAnterior × (percentComissaoAnterior / 100)
comissaoNova     = premioNovo     × (percentComissaoNova     / 100)
resultado        = comissaoNova - comissaoAnterior
```

> Os campos `comissaoNova` e `resultado` são **calculados automaticamente** e exibidos somente leitura no modal de edição.

**Resultado positivo** (verde) = comissão nova maior que a anterior — houve aumento.  
**Resultado negativo** (vermelho) = comissão nova menor que a anterior — houve redução.

### Campos editáveis vs. somente leitura

| Campo | Editável? | Observação |
|---|---|---|
| Responsável | ✓ (admin/gestor) | Usuários comuns não podem alterar |
| Status | ✓ | Todos os usuários |
| Motivo de Perda | ✓ | Obrigatório quando status = Não Renovada |
| Seguradora Nova | ✓ | Seleção da lista de seguradoras ativas |
| Prêmio Novo | ✓ | Valor numérico |
| % Comissão Nova | ✓ | 0 a 100 |
| Comissão Nova | ✗ | Calculado automaticamente |
| Resultado | ✗ | Calculado automaticamente |
| Cliente Vinculado | ✓ | Busca typeahead por nome/CPF/e-mail |
| Dados da Apólice (anteriores) | ✗ | Somente exibição |

### Importação via CSV

Colunas obrigatórias (nessa ordem):

```
Responsavel | Nome do Cliente | Email do Cliente | Telefone do Cliente |
Fim de Vigencia | Ramo | Seguradora Anterior | Premio Liquido Anterior |
Percentual Comissao Anterior | CPF/CNPJ Cliente
```

- A data de **Fim de Vigência** deve estar no formato `AAAA-MM-DD`.
- O **Responsável** é buscado por **nome exato**. Se não encontrado, o registro é atribuído ao usuário logado.
- O **CPF/CNPJ** (somente dígitos) é usado para tentar vincular automaticamente um cliente já cadastrado.
- Registros importados chegam com status `A Trabalhar` e sem dados da nova apólice.
- O botão **Modelo CSV** (admin) baixa um arquivo com os cabeçalhos corretos e uma linha de exemplo.

### Exportação via CSV

Exporta todos os registros visíveis com todos os campos, incluindo status e motivo de perda.

### Filtros disponíveis

- Ano (baseado em `fimVigencia`)
- Mês (todos os meses ou mês específico)
- Status
- Responsável (admin/gestor)

---

## 7. Seguros Novos

### Pipeline de status

```
A Trabalhar → Em Orçamento → Em Negociação → A Transmitir → Pendente → Fechado
                                                                       ↘ Perdido
```

| Status | Descrição |
|---|---|
| A Trabalhar | Oportunidade identificada, sem proposta |
| Em Orçamento | Cotação em andamento |
| Em Negociação | Proposta enviada, em tratativa |
| A Transmitir | Aprovado, aguardando emissão |
| Pendente | Pendência documental ou de pagamento |
| **Fechado** | ✅ Seguro emitido — entra nas métricas do Dashboard |
| **Perdido** | ❌ Negócio perdido — requer seleção de Motivo de Perda |

### Cálculo de Comissão nos Seguros Novos

```
comissao        = premioLiquido × (percentComissao / 100)
comissaoAReceber = calculada conforme o ramo (ver seção 5.3)
```

O campo `comissaoAReceber` representa o valor **efetivamente repassado ao corretor** após a regra do ramo ser aplicada.

### Campos do formulário de criação

| Campo | Obrigatório | Observação |
|---|---|---|
| Cliente Cadastrado | Não | Busca typeahead — ao selecionar, preenche automaticamente nome/e-mail/telefone/CPF |
| Nome do Cliente | Sim | Preenchido automaticamente se cliente selecionado |
| E-mail | Não | Preenchido automaticamente se cliente selecionado |
| Telefone | Não | Preenchido automaticamente se cliente selecionado |
| CPF/CNPJ | Não | Preenchido automaticamente se cliente selecionado |
| Responsável | Sim | Default: usuário logado |
| Data de Início de Vigência | Sim | Formato `AAAA-MM-DD` — base do filtro no Dashboard |
| Ramo | Sim | Lista de ramos ativos |
| Seguradora | Sim | Lista de seguradoras ativas |
| Prêmio Líquido | Sim | Valor numérico |
| % Comissão | Sim | 0 a 100 |
| Status | Sim | Default: A Trabalhar |
| Motivo de Perda | Condicional | Obrigatório somente quando status = Perdido |

> Quando um cliente cadastrado é selecionado, os campos de dados do cliente ficam **desabilitados** (somente leitura). Para edição manual, remova a seleção clicando no ✕ do cliente.

### Importação via CSV

Colunas obrigatórias (nessa ordem):

```
Responsavel | Nome do Cliente | Email | Telefone | CPF/CNPJ |
Inicio Vigencia | Ramo | Seguradora | Premio Liquido | Percentual Comissao
```

- O **Ramo** deve corresponder exatamente ao nome cadastrado em Configurações.
- Registros importados chegam com status `A Trabalhar`.

### Filtros disponíveis

- Ano e mês (baseado em `inicioVigencia`)
- Status
- Responsável (admin/gestor)

---

## 8. Dashboard — Cálculos e Métricas

### Filtros do Dashboard

O Dashboard aplica os seguintes filtros a **todos** os cálculos:

| Filtro | Base do filtro |
|---|---|
| Ano + Mês | Renovações: `fimVigencia` · Seguros Novos: `inicioVigencia` |
| Responsável | `responsavelId` do registro |

> Usuários com perfil `usuario` têm o filtro de responsável fixado em si mesmos.

---

### 8.1 Taxa de Conversão de Renovações

**Indicador:** percentual de negócios de renovação convertidos com sucesso.

```
Numerador   = renovadas (status = "renovado")
            + seguros_novos_fechados_considerados (fechados de ramos com "Considerar para Taxa de Conversão")

Denominador = renovadas
            + seguros_novos_fechados_considerados
            + perdas_consideradas (status = "nao_renovada" cujo motivo tem "Considerar na Taxa de Conv. Renovações" = true)

Taxa de Conversão de Renovações (%) = (Numerador / Denominador) × 100
```

**Exemplo:**
- 8 renovadas + 2 seguros novos fechados considerados = 10 no numerador
- 3 não renovadas com motivo "considerado" = 3 nas perdas
- Denominador = 10 + 3 = 13
- Taxa = (10 / 13) × 100 = **76,9%**

> **Por que seguros novos entram aqui?** Seguros novos fechados de ramos marcados como "Considerar para taxa de conversão" representam clientes que vieram do pipeline de renovações (ex.: cliente que não renovou mas contratou um seguro novo). Isso reflete uma conversão do esforço de renovação.

---

### 8.2 Taxa de Conversão de Seguros Novos

**Indicador:** eficiência no fechamento de novas oportunidades.

```
Universo considerado = seguros novos cujo ramo tem "Considerar para Taxa de Seguros Novos" = true

Fechados  = seguros do universo com status = "fechado"
Perdidos  = seguros do universo com status = "perdido" E cujo motivo tem "Considerar na Taxa de Conv. SN" = true

Taxa de Conversão de Seguros Novos (%) = (Fechados / (Fechados + Perdidos)) × 100
```

**Exemplo:**
- Ramo "Viagem" está marcado como **não considerar** → esses registros são excluídos do cálculo
- 5 fechados + 2 perdidos com motivo considerado = denominador 7
- Taxa = (5 / 7) × 100 = **71,4%**

---

### 8.3 Aumento de Comissão

**Indicador:** variação percentual entre a comissão anterior e a nova, nas renovações concluídas.

```
Universo = renovações com status = "renovado" no período filtrado

totalComissaoNova     = Σ comissaoNova    de todas as renovadas
totalComissaoAnterior = Σ comissaoAnterior de todas as renovadas

Aumento de Comissão (%) = ((totalComissaoNova - totalComissaoAnterior) / totalComissaoAnterior) × 100
```

**Exemplo:**
- Renovação 1: anterior R$ 200, nova R$ 228
- Renovação 2: anterior R$ 225, nova R$ 240
- totalNova = 468 · totalAnterior = 425
- Aumento = ((468 - 425) / 425) × 100 = **+10,1%**

> Resultado **positivo** = carteira com comissão crescendo.  
> Resultado **negativo** = comissão total caiu (ex.: clientes migraram para planos mais baratos).

---

### 8.4 Comissão Gerada em Renovações

```
Comissão Renovações = Σ comissaoNova de todas as renovações com status = "renovado" no período
```

Este valor é usado como **base de cálculo** para as metas de tipo "Percentual" do grupo Taxa de Conversão de Renovações e Aumento de Comissão.

---

### 8.5 Comissão Gerada em Seguros Novos

```
Comissão Seguros Novos = Σ comissao de todos os seguros novos com status = "fechado" no período
```

> Note: usa o campo `comissao` (prêmio × %), não `comissaoAReceber`. O `comissaoAReceber` é o repasse após regra do ramo.

Este valor é usado como **base de cálculo** para as metas do grupo Seguros Novos por Comissão e Seguros Novos por Taxa de Conversão (quando o tipo da faixa for "Percentual").

---

### 8.6 Cálculo de Remuneração (Metas)

Para cada um dos 4 grupos de metas, o sistema:

1. Calcula o **indicador atual** do período (taxa %, valor R$)
2. Percorre as **faixas** em ordem de cadastro
3. Encontra a **primeira faixa** cujos limites contenham o indicador
4. Aplica o cálculo de remuneração dessa faixa

```
Se tipo da faixa = "Percentual":
  bônus = baseDeCalculo × (valor / 100)

Se tipo da faixa = "Valor Fixo":
  bônus = valor (R$ fixo)

Se nenhuma faixa for atingida:
  bônus = R$ 0,00
```

**Remuneração Total = soma dos bônus dos 4 grupos.**

---

### 8.7 Resumos de Renovações e Seguros Novos

O Dashboard exibe dois painéis de resumo com contagens do período filtrado:

#### Renovações

| Linha | O que conta |
|---|---|
| Renovadas | `status = "renovado"` |
| Não renovadas (consideradas) | `status = "nao_renovada"` + motivo com "Considerar Taxa Conv. Renovações" = true |
| Não renovadas (não consideradas) | `status = "nao_renovada"` + motivo com "Considerar Taxa Conv. Renovações" = false |
| Total de registros | Todos os registros do período e filtro selecionados |

#### Seguros Novos

| Linha | O que conta |
|---|---|
| Fechados | `status = "fechado"` |
| Perdidos (considerados) | `status = "perdido"` + motivo com "Considerar Taxa Conv. SN" = true |
| Perdidos (não considerados) | `status = "perdido"` + motivo com "Considerar Taxa Conv. SN" = false |
| Total de registros | Todos os registros do período e filtro selecionados |

---

### 8.8 Aviso de período sem dados

Se o período selecionado (mês + ano + responsável) não retornar nenhum registro, o Dashboard exibe um aviso em amarelo orientando o usuário a verificar:
- Se o mês/ano selecionado coincide com as datas de vigência dos registros cadastrados
- Se o filtro de responsável está correto

---

## Referência rápida — Fórmulas

| Métrica | Fórmula |
|---|---|
| Comissão Anterior | `premioAnterior × (% comissão anterior / 100)` |
| Comissão Nova | `premioNovo × (% comissão nova / 100)` |
| Resultado Renovação | `comissaoNova − comissaoAnterior` |
| Comissão Seguro Novo | `premioLiquido × (% comissão / 100)` |
| Comissão a Receber (%) | `comissao × (percentualRamo / 100)` |
| Comissão a Receber (fixo) | `valorFixoRamo` |
| Taxa Conv. Renovações | `(renovadas + SN_fechados_consid) / (renovadas + SN_fechados_consid + perdas_consid) × 100` |
| Taxa Conv. Seguros Novos | `fechados / (fechados + perdidos_consid) × 100` |
| Aumento de Comissão | `((totalComissaoNova − totalComissaoAnt) / totalComissaoAnt) × 100` |
| Bônus (faixa %) | `baseDeCalculo × (valorFaixa / 100)` |
| Bônus (faixa fixo) | `valorFaixa` |

---

*Segura Mais — Manual gerado automaticamente a partir do código-fonte do sistema.*
