# Manual de Cálculo de Metas e Remunerações — Segura Mais

> Este documento descreve **exatamente** como o sistema calcula cada indicador e cada valor de remuneração exibido no Dashboard. A ordem das seções segue a ordem de prioridade do próprio sistema.

---

## Sumário

1. [Filtro de Período e Responsável](#1-filtro-de-período-e-responsável)
2. [Cadástros que influenciam os cálculos](#2-cadastros-que-influenciam-os-cálculos)
   - 2.1 Ramos
   - 2.2 Motivos de Perda
   - 2.3 Usuários
   - 2.4 Planos de Meta
3. [Indicadores — Cálculos Passo a Passo](#3-indicadores--cálculos-passo-a-passo)
   - 3.1 Taxa de Conversão de Renovações
   - 3.2 Taxa de Conversão de Seguros Novos
   - 3.3 Aumento de Comissão (Renovações)
   - 3.4 Comissão Gerada — Renovações
   - 3.5 Comissão Gerada — Seguros Novos
4. [Remunerações por Faixa de Meta](#4-remunerações-por-faixa-de-meta)
   - 4.1 Como as faixas funcionam
   - 4.2 Status de cada faixa
   - 4.3 Bônus por Taxa de Conversão de Renovações
   - 4.4 Bônus por Aumento de Comissão
   - 4.5 Bônus por Comissão de Seguros Novos
   - 4.6 Bônus por Taxa de Conversão de Seguros Novos
   - 4.7 Comissão Individual por Ramo (fora da meta)
5. [Total de Remuneração](#5-total-de-remuneração)
6. [Ordem de Prioridade — Resumo](#6-ordem-de-prioridade--resumo)
7. [Exemplos Práticos](#7-exemplos-práticos)

---

## 1. Filtro de Período e Responsável

Antes de qualquer cálculo, o sistema filtra os registros pelas seleções do Dashboard.

### Data de referência
| Tipo de registro | Campo usado para filtrar o mês/ano |
|---|---|
| Renovação | `fimVigencia` (data de fim de vigência) |
| Seguro Novo | `inicioVigencia` (data de início de vigência) |

> **Regra:** Um registro é incluído nos cálculos somente se o mês **e** o ano da data de referência coincidirem exatamente com o filtro selecionado.

### Responsável
- Se **nenhum responsável** for selecionado (opção "Todos os responsáveis"), o sistema exibe os indicadores de produção geral, mas **não exibe a seção de Metas e Remunerações** (pois as metas são individuais).
- Se um responsável for selecionado, apenas os registros com `responsavelId` igual ao ID desse usuário são considerados.
- Para usuários com perfil **Usuário**, o filtro é travado no próprio usuário logado — ele nunca vê dados de outros.

---

## 2. Cadastros que influenciam os cálculos

Os cadastros têm **prioridade sobre os cálculos**. Alterar qualquer configuração abaixo muda imediatamente o resultado exibido no Dashboard.

---

### 2.1 Ramos (`Configurações → Ramos`)

Cada ramo possui quatro chaves booleanas que afetam os cálculos:

| Campo | O que controla |
|---|---|
| `Considera para taxa de conversão (Seguros Novos)` | Se `false`, os seguros novos deste ramo são **ignorados completamente** no cálculo da Taxa de Conversão de Seguros Novos |
| `Considera para taxa de conversão (Renovações)` | Se `false`, os seguros novos deste ramo **não entram** como "fechados" no denominador da Taxa de Conversão de Renovações |
| `Remuneração individual por venda` | Se `true`, a comissão deste ramo **não entra na soma de produção da meta**; é paga diretamente por venda |
| `Tipo de comissão` + `Valor` | Define como calcular `comissaoAReceber` para ramos individuais: percentual do prêmio ou valor fixo por venda |

#### Prioridade do campo "Remuneração Individual"
Quando um ramo tem `remuneracaoIndividual = true`:
- A comissão das vendas desse ramo **não soma** para o total de produção usado nas faixas de meta
- Em vez disso, o sistema aplica a fórmula do ramo (`percentualComissao` ou `valorFixo`) sobre cada venda e soma diretamente na remuneração final
- Esse valor aparece em roxo no Dashboard como "Comissão Individual por Ramo"

---

### 2.2 Motivos de Perda (`Configurações → Motivos de Perda`)

Cada motivo de perda tem campos que filtram se aquela perda "conta" para os cálculos:

| Campo | Tipo de registro | O que controla |
|---|---|---|
| `Considera para taxa de conversão (Renovações)` | Renovação perdida | Se `false`, essa perda **não entra no denominador** da Taxa de Conversão de Renovações |
| `Considera para taxa de conversão (Seguros Novos)` | Seguro novo perdido | Se `false`, essa perda **não entra no denominador** da Taxa de Conversão de Seguros Novos |
| `Gerar prospecção ao marcar como perdido` | Ambos | Cria automaticamente um registro em Prospecção |

> **Atenção:** Perdas com o motivo marcado como "não considera para taxa" aparecem no resumo do Dashboard como "Não consideradas", mas **não afetam a taxa**. Isso é útil para perdas por motivos fora do controle do corretor (ex.: falecimento do cliente).

---

### 2.3 Usuários (`Usuários`)

O cadastro de cada usuário define **o que ele recebe e qual plano de meta aplica**:

| Campo | O que controla |
|---|---|
| `Recebe remuneração por Renovações` | Habilita/desabilita toda a seção de metas de renovação para este usuário |
| `Plano de meta — Renovações` | Qual plano (conjunto de faixas) será usado para calcular os bônus de renovação |
| `Recebe remuneração — Taxa de Conversão Ren.` | Habilita/desabilita especificamente o bônus de taxa de conversão de renovações |
| `Recebe remuneração — Aumento de Comissão` | Habilita/desabilita especificamente o bônus de aumento de comissão |
| `Recebe remuneração por Seguros Novos` | Habilita/desabilita toda a seção de metas de seguros novos |
| `Plano de meta — Seguros Novos` | Qual plano será usado para calcular os bônus de seguros novos |
| `Recebe remuneração — SN por Comissão` | Habilita/desabilita o bônus de comissão gerada de seguros novos |
| `Recebe remuneração — SN por Taxa` | Habilita/desabilita o bônus de taxa de conversão de seguros novos |

#### Regras de prioridade do usuário
1. Se `recebeRemuneracaoRenovacoes = false` → nenhum bônus de renovação é calculado, independente do plano
2. Se `recebeRemuneracaoRenovacoes = true`, mas `recebeRemuneracaoTaxaRenovacoes = false` → o bônus de taxa de renovações especificamente é desabilitado
3. Mesmo padrão para Seguros Novos e seus sub-bônus
4. Se o usuário não tem **nenhum** plano de meta configurado, o sistema usa automaticamente o **primeiro plano disponível** da lista

---

### 2.4 Planos de Meta (`Configurações → Metas`)

Existem dois tipos de plano, cada um com faixas independentes:

#### Plano de Renovação
- **Faixas de Taxa de Conversão**: faixas em percentual (%), com bônus aplicado sobre a comissão de renovações
- **Faixas de Aumento de Comissão**: faixas em percentual (%), com bônus aplicado sobre a comissão de renovações

#### Plano de Seguros Novos
- **Faixas de Comissão Gerada**: faixas em valor (R$), com bônus aplicado sobre a comissão de seguros novos da meta
- **Faixas de Taxa de Conversão**: faixas em percentual (%), com bônus aplicado sobre a comissão de seguros novos da meta

#### Tipos de bônus por faixa
| Tipo | Fórmula |
|---|---|
| `percentual` | `base de comissão × (valor da faixa / 100)` |
| `valor_fixo` | Valor fixo em R$, independente da comissão gerada |

#### Maximo `null`
Se o campo `máximo` de uma faixa for nulo/vazio, a faixa não tem limite superior — qualquer valor acima do mínimo se enquadra.

---

## 3. Indicadores — Cálculos Passo a Passo

### 3.1 Taxa de Conversão de Renovações

**O que mede:** Percentual de sucesso no trabalho de renovações, incluindo seguros novos que compensam perdas.

**Fórmula:**
```
Taxa = ( Renovadas + SN Fechados Elegíveis ) / ( Renovadas + SN Fechados Elegíveis + Perdas Consideradas ) × 100
```

**Definições:**
- **Renovadas**: renovações com `status = 'renovado'` no período/responsável filtrado
- **SN Fechados Elegíveis**: seguros novos com `status = 'fechado'` cujo ramo tem `considerarParaTaxaConversao = true`
- **Perdas Consideradas**: renovações com `status = 'nao_renovada'` cujo motivo de perda tem `considerarTaxaConversaoRenovacoes = true`

**Se o denominador for zero:** Taxa = 0%

---

### 3.2 Taxa de Conversão de Seguros Novos

**O que mede:** Percentual de negócios de seguros novos que resultam em venda.

**Fórmula:**
```
Taxa = Fechados Elegíveis / ( Fechados Elegíveis + Perdidos Considerados ) × 100
```

**Definições:**
- **Elegíveis**: seguros novos cujo ramo tem `considerarParaTaxaSegurosNovos = true`
- **Fechados Elegíveis**: dos elegíveis, aqueles com `status = 'fechado'`
- **Perdidos Considerados**: dos elegíveis, aqueles com `status = 'perdido'` cujo motivo tem `considerarTaxaConversaoSegurosNovos = true`

> Se **nenhum** seguro novo do período tiver um ramo elegível, o sistema exibe a mensagem "Nenhum seguro neste período considera taxa de conversão (ramos excluídos)" e **não exibe as faixas de meta** para evitar mostrar bônus potenciais enganosos.

**Se o denominador for zero:** Taxa = 0%

---

### 3.3 Aumento de Comissão (Renovações)

**O que mede:** Quanto a comissão total das renovações cresceu em relação ao período anterior dos mesmos contratos.

**Fórmula:**
```
Aumento = ( Soma comissão nova − Soma comissão anterior ) / Soma comissão anterior × 100
```

**Registros considerados:** Apenas renovações com `status = 'renovado'` no período filtrado.

- `comissão nova` = campo `comissaoNova` de cada renovação renovada
- `comissão anterior` = campo `comissaoAnterior` de cada renovação renovada

**Se a soma das comissões anteriores for zero:** Aumento = 0%

---

### 3.4 Comissão Gerada — Renovações

**Fórmula:**
```
Comissão Renovações = Soma de comissaoNova de todas as renovações com status = 'renovado'
```

Esta é a **base de cálculo** usada nos bônus de renovação por taxa de conversão e por aumento de comissão.

---

### 3.5 Comissão Gerada — Seguros Novos

O sistema divide os seguros novos fechados em dois grupos:

#### Grupo A — Ramos com Meta (entram na soma de produção)
```
Comissão Meta = Soma de comissao (prêmio × % comissão) dos SN fechados
                onde o ramo tem remuneracaoIndividual = false
```

#### Grupo B — Ramos Individuais (pagamento direto por venda)
```
Comissão Individual = Soma de comissaoAReceber dos SN fechados
                      onde o ramo tem remuneracaoIndividual = true
```

> O KPI "Comissão Seg. Novos" no topo do Dashboard mostra o total bruto dos dois grupos juntos. As faixas de meta, porém, usam **apenas o Grupo A** (Comissão Meta).

**Como o `comissaoAReceber` é calculado para ramos individuais:**
- Se o ramo tem `tipoComissaoSegurosNovos = 'percentual'`: `premioLiquido × (percentualComissao / 100)`
- Se o ramo tem `tipoComissaoSegurosNovos = 'valor_fixo'`: usa o `valorFixo` do ramo, independente do prêmio

---

## 4. Remunerações por Faixa de Meta

### 4.1 Como as faixas funcionam

Cada plano possui conjuntos de faixas. O sistema percorre **todas as faixas** do conjunto e encontra a faixa onde o valor atual se encaixa:

```
Para cada faixa:
  se valor_atual >= minimo E (maximo é null OU valor_atual <= maximo):
    → esta é a faixa ativa (RECEBENDO)
    → bônus = calcular conforme tipo (percentual ou valor_fixo)
    → parar a busca
```

> **Somente uma faixa é ativa por vez.** O sistema não acumula faixas.

### 4.2 Status de cada faixa

| Status | Condição | Badge |
|---|---|---|
| **RECEBENDO** | O valor atual está dentro desta faixa | Verde |
| **Atingida** | O valor atual **ultrapassou** o máximo desta faixa | Azul |
| **Potencial** | O valor atual ainda **não atingiu** o mínimo desta faixa | Amarelo |

**Exibição do potencial:**
- Se o bônus é **valor fixo**: mostra "Potencial: R$ X,XX" (valor garantido ao atingir a faixa)
- Se o bônus é **percentual** e já há comissão gerada: mostra "Potencial: R$ X,XX" (simulação com a comissão atual)
- Se o bônus é **percentual** e a comissão é zero: mostra "Potencial: X% da comissão" (sem valor em reais enganoso)

> **Importante:** As faixas com status "Atingida" **já foram superadas** — o corretor passou por elas mas está em uma faixa superior. Elas não geram bônus adicional.

---

### 4.3 Bônus por Taxa de Conversão de Renovações

**Condições para ser calculado:**
1. Usuário tem `recebeRemuneracaoRenovacoes = true`
2. Usuário tem `recebeRemuneracaoTaxaRenovacoes = true`
3. Existe pelo menos um plano de meta de renovação vinculado ao usuário
4. Existem registros de renovação no período (se não houver, a seção exibe aviso e bônus = R$ 0,00)

**Valor medido nas faixas:** Taxa de Conversão de Renovações (%)

**Base de cálculo do bônus percentual:** Comissão Gerada de Renovações (R$)

**Exemplo:**
- Taxa atual: 85%
- Faixa ativa: 80%–100% → bônus de 5% da comissão
- Comissão de renovações: R$ 3.000,00
- **Bônus = R$ 3.000,00 × 5% = R$ 150,00**

---

### 4.4 Bônus por Aumento de Comissão

**Condições para ser calculado:**
1. Usuário tem `recebeRemuneracaoRenovacoes = true`
2. Usuário tem `recebeRemuneracaoAumentoComissao = true`
3. Existe pelo menos um plano de meta de renovação
4. Existem registros de renovação no período

**Valor medido nas faixas:** Aumento de Comissão (%)

**Base de cálculo do bônus percentual:** Comissão Gerada de Renovações (R$)

**Exemplo:**
- Aumento atual: 12%
- Faixa ativa: 10%–20% → bônus de 3% da comissão
- Comissão de renovações: R$ 3.000,00
- **Bônus = R$ 3.000,00 × 3% = R$ 90,00**

---

### 4.5 Bônus por Comissão de Seguros Novos

**Condições para ser calculado:**
1. Usuário tem `recebeRemuneracaoSegurosNovos = true`
2. Usuário tem `recebeRemuneracaoSnComissao = true`
3. Existe pelo menos um plano de meta de seguros novos

**Valor medido nas faixas:** Comissão Meta de Seguros Novos — Grupo A (R$)

> Ramos com `remuneracaoIndividual = true` são **excluídos** desta soma.

**Base de cálculo do bônus percentual:** Comissão Meta de Seguros Novos (R$)

**Exemplo:**
- Comissão Meta gerada: R$ 2.500,00
- Faixa ativa: R$ 2.000,00–R$ 3.000,00 → bônus de 4%
- **Bônus = R$ 2.500,00 × 4% = R$ 100,00**

---

### 4.6 Bônus por Taxa de Conversão de Seguros Novos

**Condições para ser calculado:**
1. Usuário tem `recebeRemuneracaoSegurosNovos = true`
2. Usuário tem `recebeRemuneracaoSnTaxa = true`
3. Existe pelo menos um plano de meta de seguros novos
4. Existem seguros novos cujo ramo considera a taxa (`considerarParaTaxaSegurosNovos = true`)

**Valor medido nas faixas:** Taxa de Conversão de Seguros Novos (%)

**Base de cálculo do bônus percentual:** Comissão Meta de Seguros Novos — Grupo A (R$)

**Exemplo:**
- Taxa atual: 70%
- Faixa ativa: 60%–80% → bônus de R$ 200,00 (valor fixo)
- **Bônus = R$ 200,00**

---

### 4.7 Comissão Individual por Ramo (fora da meta)

**Condições para aparecer:**
1. Usuário tem `recebeRemuneracaoSegurosNovos = true`
2. Existem seguros novos fechados no período de ramos com `remuneracaoIndividual = true`

**Fórmula:** Para cada venda de ramo individual:
```
Se tipo = 'percentual':  comissaoAReceber = premioLiquido × (percentualComissao do ramo / 100)
Se tipo = 'valor_fixo':  comissaoAReceber = valorFixo do ramo
```

O sistema agrupa por ramo e mostra o subtotal de cada um.

> Este valor **não passa pelas faixas de meta**. É somado diretamente ao total de remuneração.

---

## 5. Total de Remuneração

O total exibido no canto superior direito da seção de Metas é a soma de todos os bônus calculados:

```
Total = Bônus Taxa Renovações
      + Bônus Aumento Comissão
      + Bônus SN por Comissão
      + Bônus SN por Taxa
      + Comissão Individual por Ramo
```

Cada componente só entra na soma se estiver habilitado **e** se houver dados no período.

---

## 6. Ordem de Prioridade — Resumo

O sistema aplica as configurações na seguinte ordem. Cada nível pode **bloquear ou modificar** os cálculos dos níveis seguintes.

```
1. FILTRO DE PERÍODO
   └─ Mês/Ano + fimVigencia (renovações) ou inicioVigencia (SN)
   └─ Se nenhum registro → indicadores zerados, metas não exibidas

2. FILTRO DE RESPONSÁVEL
   └─ Admin/Gestor sem responsável selecionado → metas não exibidas
   └─ Usuário: sempre filtrado pelo próprio ID

3. CADASTRO DO RAMO (por seguro/renovação individual)
   └─ remuneracaoIndividual → separa da meta ou entra na meta
   └─ considerarParaTaxaSegurosNovos → inclui ou exclui da taxa de conversão SN
   └─ considerarParaTaxaConversao → inclui ou exclui SN fechados na taxa de renovações

4. CADASTRO DO MOTIVO DE PERDA (por registro perdido individual)
   └─ considerarTaxaConversaoRenovacoes → inclui ou exclui do denominador da taxa de renovações
   └─ considerarTaxaConversaoSegurosNovos → inclui ou exclui do denominador da taxa de SN

5. CADASTRO DO USUÁRIO
   └─ recebeRemuneracaoRenovacoes → habilita/desabilita TODOS os bônus de renovação
   └─ recebeRemuneracaoTaxaRenovacoes → habilita/desabilita bônus de taxa de renovações
   └─ recebeRemuneracaoAumentoComissao → habilita/desabilita bônus de aumento
   └─ recebeRemuneracaoSegurosNovos → habilita/desabilita TODOS os bônus de SN
   └─ recebeRemuneracaoSnComissao → habilita/desabilita bônus de comissão de SN
   └─ recebeRemuneracaoSnTaxa → habilita/desabilita bônus de taxa de SN
   └─ planoMetaRenovacaoId → seleciona qual conjunto de faixas usar (renovações)
   └─ planoMetaSeguroNovoId → seleciona qual conjunto de faixas usar (SN)

6. PLANO DE META (faixas)
   └─ Busca a faixa onde o valor atual se encaixa
   └─ Calcula o bônus (percentual × base ou valor fixo)
   └─ Somente uma faixa ativa por indicador
```

---

## 7. Exemplos Práticos

### Exemplo A — Corretor sem renovações no período

> João Silva, junho/2026, sem nenhuma renovação cadastrada no mês.

| Campo | Valor |
|---|---|
| Taxa de Conversão Renovações | 0% |
| Bônus taxa de renovações | R$ 0,00 |
| Bônus aumento de comissão | R$ 0,00 |

**Por que o Dashboard não exibe "Potencial: R$ 500"?**
Porque o sistema detecta `rv.length === 0` e exibe a mensagem "Nenhuma renovação registrada neste período" em vez das faixas. Evita mostrar potenciais enganosos sobre uma base de comissão zero.

---

### Exemplo B — Ramo Viagem com remuneração individual

> Configuração: Ramo "Viagem" com `remuneracaoIndividual = true`, `tipo = valor_fixo`, `valorFixo = R$ 50,00`

| Venda | Prêmio | Entra na meta de comissão SN? | Comissão individual |
|---|---|---|---|
| Viagem #1 | R$ 800,00 | Não | R$ 50,00 |
| Viagem #2 | R$ 1.200,00 | Não | R$ 50,00 |
| Auto #1 | R$ 600,00 | Sim (+R$ 60,00) | — |

- Comissão Meta (para faixas): R$ 60,00
- Comissão Individual (direto): R$ 100,00
- O Dashboard mostra em roxo: "Viagem — R$ 100,00"

---

### Exemplo C — Motivo de perda "não considerado"

> Renovação perdida com motivo "Falecimento do cliente" (`considerarTaxaConversaoRenovacoes = false`).

- Esta perda aparece no resumo como "Não renovadas (não consideradas)"
- O denominador da taxa de renovações **não inclui** esta perda
- A taxa fica mais alta do que seria se a perda fosse contada

---

### Exemplo D — Admin sem responsável selecionado

> Admin visualiza o Dashboard com "Todos os responsáveis".

- Os KPIs de produção mostram a soma geral de todos os corretores
- A seção "Metas e Remunerações" **não aparece**
- Um banner azul informa: "Selecione um responsável no filtro acima para visualizar as metas e remunerações individuais"

---

### Exemplo E — Faixas de meta e qual está ativa

> Plano com 3 faixas de taxa de conversão de renovações:
> - Faixa 1: 0%–69% → R$ 0,00
> - Faixa 2: 70%–89% → 3% da comissão
> - Faixa 3: 90%–sem limite → 5% da comissão

**Se taxa atual = 82%:**
- Faixa 1: Atingida (passou por ela)
- Faixa 2: **RECEBENDO** (está dentro dela)
- Faixa 3: Potencial (ainda não chegou)
- Comissão renovações = R$ 4.000,00 → **Bônus = R$ 120,00**

**Se taxa atual = 95%:**
- Faixa 1: Atingida
- Faixa 2: Atingida
- Faixa 3: **RECEBENDO**
- Comissão renovações = R$ 4.000,00 → **Bônus = R$ 200,00**

---

*Última atualização: Abril 2026 — versão do sistema: 2026-v5*
