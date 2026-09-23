# Spec — Orçamento, Compromissos Futuros e Investimentos

> **Escopo deste documento:** ao contrário de
> [`especificacao-funcional.md`](./especificacao-funcional.md), que descreve o sistema
> **como ele é hoje**, este documento descreve o que **ainda não existe**. É uma
> especificação de implementação para três capacidades pedidas:
>
> 1. **Orçamento derivado do histórico de gastos** — o sistema propõe os tetos, o usuário revisa
> 2. **Compromissos futuros** — parcelas de compras, contas recorrentes, fatura de cartão
> 3. **Investimentos** — ativos, posições, preço médio e cotação
>
> Escrito em 03/09/2026. Nada aqui está implementado.
> Antes de mexer em qualquer tela, leia [`contrato-api.md`](./contrato-api.md).

---

## 0. Pré-requisitos — não comece sem isso

Dois itens do §12 da especificação funcional **bloqueiam** tudo que vem abaixo. Não são
parte desta spec, mas precisam vir antes:

| # | Item | Por que bloqueia |
|---|---|---|
| 1 | ~~**Timezone ignorado**~~ — **resolvido em 23/09/2026**; usar `common/datas.ts` para toda data nova (vencimento, fechamento de fatura) (§8) — todo cálculo de mês usa o relógio do servidor em UTC | Parcela, vencimento, fechamento de fatura e fronteira de mês do orçamento são todos datados. Entre 21h e meia-noite no Brasil o servidor já virou o dia; no último dia do mês, virou o mês. Uma parcela cai na fatura errada e o orçamento fecha no dia errado. Construir projeção sobre esse bug é construir sobre areia |
| 2 | ~~**Sessão cai a cada 15 min**~~ — **resolvido em 22/09/2026** (§2) | Cadastrar uma compra em 12x, revisar 15 sugestões de orçamento ou lançar uma carteira de investimentos são fluxos longos. Perder a sessão no meio deles é inviável |

Recomendação operacional adicional: **configurar backup do Postgres antes da Fase 1**
(ver `project-railway-deploy-pendencias`). Tudo nesta spec multiplica o volume de dados
reais guardados na aplicação.

---

## 1. O conceito que sustenta tudo: previsto × realizado

> **Implementada em 23/09/2026**, com um desvio: a metade de cartão da regra do
> §1.2 (`cardId IS NOT NULL` não mexe no saldo) **ficou para a Fase 3** (aplicada lá, em 23/09/2026). Aplicá-la
> sem fatura faria compra no cartão não afetar saldo nenhum, sem ainda existir
> como registrar o pagamento. Hoje compra no cartão ainda debita a conta na hora,
> como antes. Também: a projeção soma previstas até o fim do mês, inclusive as
> atrasadas; `chart-categories` e o orçamento só contam realizadas; o orçamento
> ainda não mostra `comprometido` (fica para a Fase 4, §5.2).

Hoje toda transação é um fato consumado — ela é criada e o saldo da conta muda na hora
(`transactions.service.ts:79`). Não existe forma de dizer "isso vai acontecer no dia 10".

Sem essa distinção não há parcela, não há recorrência e não há projeção. Ela é o
primeiro item a implementar.

### 1.1 Reaproveitar `confirmada`

A coluna `transactions.confirmada` já existe (`boolean`, padrão `true`) e **nunca é lida
por ninguém**. Ela passa a significar:

| Valor | Significado | Entra em `saldoAtual` | Entra no `summary` do mês | Entra na projeção | Entra no orçamento |
|---|---|---|---|---|---|
| `true` | **Realizado** — o dinheiro se moveu | ✅ | ✅ | ✅ | como `gastoRealizado` |
| `false` | **Previsto** — está agendado | ❌ | ❌ | ✅ | como `comprometido` |

Como o padrão da coluna é `true` e toda linha existente foi criada como fato consumado,
**a mudança é retrocompatível sem backfill**.

### 1.2 Regra única do saldo

> `account.saldoAtual` só é afetado por transações com `cardId IS NULL` **e**
> `confirmada = true`.

A segunda metade dessa regra é nova e é o que impede a contagem dupla do cartão: a compra
no crédito não tira dinheiro da conta, o **pagamento da fatura** tira (§3).

Matriz de efeito no saldo, para implementar em `TransactionsService`:

| Operação | `confirmada` antes | depois | Efeito em `saldoAtual` |
|---|---|---|---|
| criar | — | `true` | aplica delta |
| criar | — | `false` | nenhum |
| confirmar | `false` | `true` | aplica delta |
| desconfirmar | `true` | `false` | reverte delta |
| editar valor/tipo | `true` | `true` | reverte antigo, aplica novo |
| editar valor/tipo | `false` | `false` | nenhum |
| excluir | `true` | — | reverte delta |
| excluir | `false` | — | nenhum |

Em todos os casos, se `cardId IS NOT NULL`: efeito nenhum.

### 1.3 `data` × `dataCompetencia` — regime de caixa e de competência

A coluna `dataCompetencia` também já existe e nunca foi preenchida. A partir daqui:

| Coluna | Significado | Exemplo: compra de R$ 1.200 em 12x no cartão, feita em 20/03 |
|---|---|---|
| `data` | **Caixa** — quando o dinheiro se move | parcela 1 vence 10/04 → `data = 2026-04-10` |
| `dataCompetencia` | **Competência** — quando o fato gerador aconteceu | `dataCompetencia = 2026-03-20` em todas as 12 parcelas |

Para débito, dinheiro e transferência as duas são iguais e `dataCompetencia` fica nula.

**Qual das duas cada cálculo usa** — esta tabela é a parte mais importante da spec:

| Cálculo | Data usada | Por quê |
|---|---|---|
| `account.saldoAtual` | `data` | é caixa: o saldo é o dinheiro que está lá |
| `dashboard/summary` (entradas e saídas do mês) | `data` | é fluxo de caixa do mês |
| `dashboard/projection` | `data` | projeta caixa |
| **`budgets` — gasto por categoria** | **`COALESCE(dataCompetencia, data)`** | você gastou em restaurante em março, ainda que pague em abril. Orçar por caixa faria a compra parcelada poluir 12 meses de orçamento de uma categoria |
| `chart-categories` | `COALESCE(dataCompetencia, data)` | mesma razão |

O `COALESCE` garante que toda linha existente (com `dataCompetencia` nula) continue
sendo contada exatamente como hoje.

> Referência: [regime de caixa × regime de competência](https://www.afixcode.com.br/blog/regime-caixa-regime-competencia/).
> É a distinção contábil que resolve cartão de crédito em app de finanças pessoais.

### 1.4 Mudanças de API na Fase 1

| Método | Rota | Observação |
|---|---|---|
| POST | `/transactions/:id/confirmar` | `confirmada = false → true`, aplica o delta. 409 se já confirmada |
| POST | `/transactions/:id/desconfirmar` | inverso. 409 se a transação for parcela de fatura já paga |
| GET | `/transactions` | ganha query `confirmada` (`true` \| `false` \| omitido = ambas) |
| POST | `/transactions` | DTO ganha `confirmada?: boolean` (padrão `true`) e `dataCompetencia` passa a ser usada |

⚠️ `forbidNonWhitelisted` está ligado: `confirmada` **já existe** no `CreateTransactionDto`,
mas `dataCompetencia` precisa ser montada explicitamente no payload do frontend.

---

## 2. Parcelamento

> **Implementada em 23/09/2026.** Desvios: não aceita `cardId` até a Fase 3 (sem
> fatura, criaria dados que precisariam de backfill); query `cardId` do
> `GET /installments` também fica para lá. Acréscimos: parcela não pode ser
> excluída nem ter `valor`/`data`/conta alterados sozinha (quebraria a
> invariante do §2.3); desconfirmar parcela de parcelamento cancelado dá 409;
> `numeroParcelas` limitado a 120.

### 2.1 Decisão de modelagem

Parcelado e recorrente são **duas entidades distintas**, não uma tabela genérica de
"recorrências" com um campo `tipo`. A diferença é substantiva:

| | Parcelado | Recorrente |
|---|---|---|
| Fim | conhecido (12 de 12) | indefinido |
| Valor total | conhecido na origem | desconhecido |
| Cancelar | encerra as parcelas futuras em cascata | encerra a regra |
| Pergunta que responde | "quanto ainda devo dessa compra?" | "quanto gasto por mês com isso?" |

> Referência: [discussão no TabNews sobre modelar lançamentos fixos e parcelados](https://www.tabnews.com.br/CaioDev/como-modelar-lancamentos-fixos-e-parcelados-em-um-app-de-financas-pessoais).
> A proposta original era uma tabela única; a resposta mais bem fundamentada argumenta
> por separar, e é a que esta spec segue.

### 2.2 Tabela `installment_purchases`

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `userId` | uuid | FK, `ON DELETE CASCADE` |
| `accountId` | uuid | FK — conta que paga (obrigatória, como em `transactions`) |
| `cardId` | uuid nullable | FK — nulo = carnê, boleto ou crediário |
| `categoryId` | uuid nullable | FK, `ON DELETE SET NULL` |
| `descricao` | varchar(255) | "Notebook Dell" |
| `valorTotal` | numeric(15,2) | |
| `numeroParcelas` | int | `>= 2` |
| `valorParcela` | numeric(15,2) | gravado, não derivado — ver §2.3 |
| `dataCompra` | date | vira `dataCompetencia` de todas as parcelas |
| `primeiroVencimento` | date | |
| `status` | varchar(20) | `ativa` \| `quitada` \| `cancelada` |
| `dataCriacao`, `dataAtualizacao` | timestamp | |

Índice: `['userId', 'status']`.

Colunas novas em `transactions`:

| Coluna | Tipo | Notas |
|---|---|---|
| `installmentPurchaseId` | uuid nullable | FK, `ON DELETE CASCADE` |
| `numeroParcela` | int nullable | 1..N |

### 2.3 Regra de arredondamento — invariante obrigatória

> **`SUM(valor das parcelas) = valorTotal`, exatamente, sempre.**

R$ 100,00 em 3x não são três parcelas de R$ 33,33 (isso soma R$ 99,99). Algoritmo:

```
valorParcela = trunc(valorTotal / n, 2)          // 33.33
residuo      = valorTotal - (valorParcela * n)   // 0.01
// o resíduo vai integralmente na PRIMEIRA parcela
parcela[1] = valorParcela + residuo              // 33.34
parcela[2..n] = valorParcela                     // 33.33
```

Resíduo na primeira parcela, não na última: é a prática mais comum das operadoras
brasileiras e evita que um cancelamento no meio deixe o total sem fechar.

### 2.4 Geração das parcelas

`POST /installments` cria a compra **e** as N transações filhas, na mesma transação de banco:

- `tipo = 'despesa'`, `descricao = "{descricao} ({i}/{n})"`
- `dataCompetencia = dataCompra` em todas
- `data` = `primeiroVencimento` acrescido de `i-1` meses
- `confirmada = data <= hoje` — parcelas já vencidas nascem confirmadas (permite cadastrar
  retroativamente uma compra já em andamento), futuras nascem previstas
- `accountId`, `cardId`, `categoryId` herdados da compra

**Ajuste de dia do mês:** ao somar meses, se o dia não existir no mês de destino (31/01 → 31/02),
usar o **último dia do mês**. Nunca transbordar para o mês seguinte.

### 2.5 Cancelamento em cascata

`DELETE /installments/:id` não apaga histórico:

- parcelas com `confirmada = false` → **excluídas**
- parcelas com `confirmada = true` → **mantidas**, com `installmentPurchaseId` preservado
  (o dinheiro saiu de verdade; apagar corromperia o saldo)
- `status = 'cancelada'`

`status` vira `quitada` automaticamente quando a última parcela é confirmada.

### 2.6 Endpoints

| Método | Rota | Resposta |
|---|---|---|
| GET | `/installments` | `{ data: [...] }` — query `status`, `cardId` |
| GET | `/installments/:id` | inclui `parcelas: Transaction[]` |
| POST | `/installments` | cria compra + N parcelas |
| PATCH | `/installments/:id` | **só** `descricao` e `categoryId` — ver limitação abaixo |
| DELETE | `/installments/:id` | 204, cascata do §2.5 |

Campos derivados na leitura: `parcelasPagas`, `parcelasRestantes`, `valorPago`,
`saldoDevedor`, `proximoVencimento`.

**Limitação assumida na v1:** não há renegociação — mudar valor total ou número de parcelas
depois de criada. Antecipação de parcelas, juros por atraso e mudança de vencimento também
ficam de fora. Para corrigir um erro de cadastro, cancele e recadastre.

---

## 3. Fatura de cartão

> **Implementada em 23/09/2026**, junto com a metade de cartão da regra do §1.2
> e o `cardId` no parcelamento. Diferenças: o pagamento é uma **transferência sem
> destino** (mexe no saldo, fora dos totais), não uma despesa; `status` grava só
> `aberta`/`paga` e deriva `fechada`; fatura aberta vazia é apagada; há
> `POST /card-invoices/:id/desfazer-pagamento`; o backfill do §3.4 zera o
> `cardId` das transações antigas em vez de vinculá-las a faturas; cadastro de
> cartão passou a aceitar só os 4 últimos dígitos.

Sem isso, gasto no crédito ou some do fluxo de caixa ou é contado duas vezes. É o par
obrigatório do §2 — parcelamento sem fatura fica pela metade.

Os campos necessários **já existem** em `cards` e nunca foram usados:
`dataFechamentoFatura` (dia do mês) e `vencimentoFatura` (dia do mês).

### 3.1 Tabela `card_invoices`

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `userId`, `cardId` | uuid | FK |
| `mes`, `ano` | int | competência da fatura |
| `dataFechamento`, `dataVencimento` | date | resolvidas a partir de `cards` |
| `valorTotal` | numeric(15,2) | soma das transações vinculadas, recalculada |
| `status` | varchar(20) | `aberta` \| `fechada` \| `paga` |
| `pagamentoTransactionId` | uuid nullable | a despesa gerada na conta ao pagar |

Índice único: `['cardId', 'mes', 'ano']`.

Coluna nova em `transactions`: `cardInvoiceId` uuid nullable, `ON DELETE SET NULL`.

### 3.2 Em qual fatura a compra cai

```
fatura alvo = a primeira fatura do cartão cujo dataFechamento >= dataCompetencia da compra
```

Se `vencimentoFatura < dataFechamentoFatura` (fecha dia 28, vence dia 5), o vencimento é
no **mês seguinte** ao fechamento. Faturas são criadas sob demanda: ao lançar uma compra
sem fatura aberta correspondente, cria-se a fatura.

### 3.3 Pagamento

`POST /card-invoices/:id/pagar` com `{ accountId, data, valor? }`:

1. cria a transação de pagamento com `cardId = null`, `accountId` informado,
   `confirmada = true` — **esta** é a que mexe no saldo. **Não** é `despesa`: as
   compras já contaram como despesa, e o `summary` somaria o mesmo gasto duas vezes.
   É uma transferência da conta para o cartão — a mesma regra da transferência
   entre contas (implementada em 23/09/2026): mexe no saldo, fica fora dos totais.
   Como cartão não é conta, o destino precisa de um campo próprio (ex.:
   `cardInvoiceId`) em vez de `contaDestinoId`. Isso também resolve a decisão 3
   do §7 (categoria do pagamento): fica sem categoria
2. grava `pagamentoTransactionId`, `status = 'paga'`
3. confirma em bloco as transações da fatura (`confirmada = true`) — elas continuam sem
   afetar o saldo por terem `cardId` preenchido, mas passam a contar como realizadas no
   orçamento

Pagamento parcial é **proibido** (decisão 2 do §7): o body não tem `valor`, e o
pagamento é sempre do total da fatura.

### 3.4 Backfill

A regra do §1.2 muda o comportamento de transações com `cardId` preenchido. Como **não
existe tela de cartões** (§10 da especificação funcional), a expectativa é que a base não
tenha nenhuma. Confirmar antes da migration:

```sql
SELECT count(*) FROM transactions WHERE "cardId" IS NOT NULL;
```

Se retornar zero, não há backfill. Se não, essas transações precisam ser vinculadas a
faturas e o `saldoAtual` das contas afetadas recalculado.

---

## 4. Contas recorrentes

### 4.1 Tabela `recurring_rules`

A coluna `transactions.recorrencia` continua existindo como rótulo, mas a geração passa a
vir daqui. `recorrenciaGrupoId` e `proximoVencimento` — nunca preenchidas — são
**substituídas** por esta tabela e devem ser removidas.

| Coluna | Tipo | Notas |
|---|---|---|
| `id`, `userId` | uuid | |
| `accountId` | uuid | FK |
| `cardId`, `categoryId` | uuid nullable | FK |
| `descricao` | varchar(255) | |
| `tipo` | varchar(20) | `receita` \| `despesa` |
| `valorEstimado` | numeric(15,2) | |
| `valorVariavel` | boolean | padrão `false` — ver §4.2 |
| `frequencia` | varchar(20) | `semanal` \| `mensal` \| `anual` |
| `diaDoMes` | int nullable | 1–31, para `mensal` e `anual` |
| `mesDoAno` | int nullable | 1–12, para `anual` |
| `diaDaSemana` | int nullable | 0–6, para `semanal` |
| `dataInicio` | date | |
| `dataFim` | date nullable | nulo = indefinida |
| `ativa` | boolean | padrão `true` |

Coluna nova em `transactions`: `recurringRuleId` uuid nullable, `ON DELETE SET NULL`.

Índice único em `transactions`: `['recurringRuleId', 'data']` — é a chave de idempotência
do §4.3.

### 4.2 Valor fixo × valor variável

- **`valorVariavel = false`** (Netflix, aluguel): a ocorrência prevista usa `valorEstimado`.
- **`valorVariavel = true`** (luz, água): a ocorrência prevista usa a **média das últimas 3
  ocorrências confirmadas** dessa regra; sem histórico suficiente, cai em `valorEstimado`.

Em ambos os casos o valor previsto é uma estimativa — ao confirmar, o usuário informa o
valor real.

### 4.3 Geração — job diário idempotente

A armadilha documentada pelo Firefly III é que auto-budgets e recorrências criadas "no dia"
simplesmente **não acontecem** se o cron falhar naquele momento. A geração aqui é desenhada
para não ter esse problema:

> O job não gera "a ocorrência de hoje". Ele garante que **existam todas as ocorrências
> previstas dentro de uma janela de 12 meses à frente**, criando as que faltarem.

Consequências: rodar duas vezes no mesmo dia não duplica nada (o índice único
`['recurringRuleId','data']` é a garantia final); perder três dias de execução se recupera
sozinho na próxima; e criar uma regra nova materializa 12 meses de previsão na hora, sem
esperar o cron.

Ocorrências geradas nascem `confirmada = false`. Desativar a regra (`ativa = false`)
remove as previstas futuras e mantém as confirmadas — mesma lógica do §2.5.

Ajuste de dia do mês: idêntico ao §2.4 (31 → último dia do mês).

### 4.4 Endpoints

| Método | Rota | Observação |
|---|---|---|
| GET | `/recurring-rules` | `{ data: [...] }` |
| POST | `/recurring-rules` | gera a janela de 12 meses na criação |
| PATCH | `/recurring-rules/:id` | regenera as previstas futuras |
| DELETE | `/recurring-rules/:id` | cascata do §4.3 |

> Referências: [Firefly III — recurring transactions](https://docs.firefly-iii.org/explanation/financial-concepts/recurring/)
> e [subscriptions](https://docs.firefly-iii.org/explanation/financial-concepts/subscriptions/).

---

## 5. Orçamento

### 5.1 Mudanças na entidade `Budget`

| Coluna | Ação | Notas |
|---|---|---|
| `gastoAtual` | **remover** | coluna morta hoje — o valor exibido já é recalculado a cada leitura |
| `rollover` | **adicionar** varchar(20) | `nenhum` (padrão) \| `acumula` \| `ajustado` |
| `saldoAnterior` | **adicionar** numeric(15,2) default 0 | resultado do mês anterior, conforme §5.3 |

### 5.2 Campos derivados na leitura

`enrichWithProgress()` passa a devolver:

| Campo | Cálculo |
|---|---|
| `gastoRealizado` | despesas da categoria no mês com `confirmada = true`, por competência |
| `comprometido` | despesas da categoria no mês com `confirmada = false` (parcelas + recorrências) |
| `disponivel` | `limiteMensal + saldoAnterior - gastoRealizado - comprometido` |
| `percentualUtilizado` | `gastoRealizado / limiteMensal` — **significado inalterado** |
| `percentualComprometido` | `(gastoRealizado + comprometido) / limiteMensal` |
| `emAlerta`, `estourado` | inalterados, sobre `percentualUtilizado` |

⚠️ `percentualUtilizado` mantém exatamente o significado atual de propósito. Mudá-lo para
incluir o comprometido quebraria silenciosamente as telas existentes — exatamente a classe
de bug descrita no cabeçalho de [`contrato-api.md`](./contrato-api.md). O número novo vem
em campo novo.

### 5.3 Rollover

Calculado no primeiro acesso ao orçamento de um mês, a partir do mês anterior da mesma
categoria:

| Modo | `saldoAnterior` do mês seguinte |
|---|---|
| `nenhum` | `0` — cada mês começa do zero (comportamento atual) |
| `acumula` | `max(0, disponivel)` — sobra vira folga, estouro não persegue |
| `ajustado` | `disponivel`, inclusive negativo — o estouro é descontado do mês seguinte |

**Piso do modo `ajustado`:** se o estouro passar de 2× o `limiteMensal`, `saldoAnterior` é
fixado em `-(limiteMensal - 1)`, deixando o limite efetivo em R$ 1,00 simbólico em vez de
um buraco impagável. Regra copiada do Firefly III.

> Referências: [Firefly III — auto-budgets](https://github.com/firefly-iii/docs/blob/main/docs/docs/how-to/firefly-iii/finances/budgets.md)
> (os três modos) e [Actual Budget — envelope budgeting](https://actualbudget.org/docs/getting-started/envelope-budgeting/)
> (rollover e realocação entre categorias).

### 5.4 `GET /budgets/sugestoes?mes=&ano=` — o coração da funcionalidade

Este é o endpoint que responde ao pedido "criar um orçamento segundo meus gastos". Ele
**não grava nada**: propõe, e o usuário aceita.

**Janela:** os **6 meses fechados** anteriores ao mês alvo. O mês corrente é excluído por
estar incompleto — incluí-lo puxaria todas as sugestões para baixo.

**Por categoria de despesa**, monta a série mensal (por competência, só `confirmada = true`)
e classifica:

| Classe | Critério | Sugestão |
|---|---|---|
| **fixa** | aparece em ≥ 5 dos 6 meses **e** coeficiente de variação ≤ 0,15 | **média** |
| **variável** | aparece em ≥ 3 dos 6 meses | **mediana** |
| **esporádica** | aparece em ≤ 2 dos 6 meses | `total dos 12 últimos meses / 12` |

Coeficiente de variação = desvio padrão populacional ÷ média.

A mediana é usada nas variáveis de propósito, não a média: um mês com uma compra atípica
distorce a média e infla o teto para sempre. A mediana ignora o outlier.

As **esporádicas** aplicam a Regra 2 do YNAB, *"Embrace Your True Expenses"*: IPVA, seguro e
IPTU não são despesa de um mês, são despesa anual paga de uma vez. Diluir por 12 é o que
impede que o mês do vencimento estoure o orçamento inteiro.

**Piso por compromisso já assumido:** se o valor sugerido for menor que o `comprometido` da
categoria no mês alvo (parcelas e recorrências já agendadas), a sugestão vira o
`comprometido` e o item recebe `ajustadoPorCompromissos: true`. Sugerir um teto que já
nasce estourado seria inútil.

**Resposta:**

```jsonc
{
  "periodo": { "mes": 10, "ano": 2026 },
  "rendaPrevista": 9800.00,      // receitas recorrentes + mediana das receitas da janela
  "totalSugerido": 7350.00,
  "aAlocar": 2450.00,            // rendaPrevista - totalSugerido  (o "To Budget" do Actual)
  "data": [
    {
      "categoryId": "uuid",
      "categoria": "Mercado",
      "classe": "variavel",           // fixa | variavel | esporadica
      "sugerido": 1200.00,            // o valor a aplicar
      "media": 1310.00,
      "mediana": 1200.00,
      "p75": 1420.00,                 // opção "com folga" na UI
      "mesesComGasto": 6,
      "comprometido": 0.00,
      "ajustadoPorCompromissos": false,
      "orcamentoExistente": null      // preenchido se já houver budget no período
    }
  ]
}
```

`media`, `mediana` e `p75` vão juntos de propósito: permitem que a tela ofereça
**apertado / realista / com folga** sem uma segunda chamada.

O `aAlocar` é o número que força a decisão — se for negativo, o orçamento planejado não
cabe na renda, e é melhor descobrir isso ao montar o orçamento do que no dia 20.

### 5.5 `POST /budgets/aplicar-sugestoes`

```jsonc
{ "mes": 10, "ano": 2026,
  "itens": [ { "categoryId": "uuid", "limiteMensal": 1200.00, "rollover": "acumula" } ] }
```

Cria em lote, em uma transação de banco. Categoria que já tem orçamento no período é
**atualizada**, não duplicada — hoje `POST /budgets` responde 409 nesse caso
(`budgets.service.ts:55`).

---

## 6. Investimentos

Hoje um investimento é uma `account` de `tipo = 'investimento'` com `saldoAtual` digitado à
mão. Não há ativo, quantidade, preço médio nem cotação.

### 6.1 Tabelas

```
assets                    catálogo de ativos
  id, userId (nullable — nulo = catálogo global, como em categories)
  ticker varchar(20), nome varchar(255)
  tipo varchar(20)        acao | fii | etf | bdr | tesouro | cripto | renda_fixa
  moeda varchar(3)        padrão BRL
  fonteCotacao varchar(20)  brapi | manual

investment_transactions   movimentos
  id, userId, accountId, assetId
  tipo varchar(20)        compra | venda | dividendo | jcp | rendimento | taxa
  quantidade numeric(18,8)      -- 8 casas: cripto e frações de ETF
  precoUnitario numeric(15,6)
  taxas numeric(15,2)     corretagem, emolumentos
  data date

asset_quotes              cotações
  assetId, data, preco numeric(15,6)
  PK composta (assetId, data)
```

`positions` **não é tabela** na v1 — é derivada de `investment_transactions` na leitura.
Materializar posição é a mesma armadilha do `account.saldoAtual` mantido por efeito
colateral (§3 da especificação funcional): rápido de ler, e diverge silenciosamente. Se a
performance exigir, vira *materialized view* depois, sempre recalculável a partir do histórico.

### 6.2 Preço médio

Custo médio ponderado, que é o critério da Receita Federal:

```
compra:  custoTotal += (quantidade × precoUnitario) + taxas
         quantidade += qtd
         precoMedio  = custoTotal / quantidade

venda:   quantidade -= qtd
         custoTotal -= qtd × precoMedio          // preço médio NÃO muda
         lucroRealizado += qtd × (precoVenda − precoMedio) − taxas
```

Venda não altera o preço médio — só reduz a quantidade e realiza resultado. Errar isso é o
bug clássico de tracker de carteira.

### 6.3 Relação com `accounts` — a regra que evita o bloqueio

> Para contas de `tipo = 'investimento'`, `saldoAtual` passa a ser **derivado**: soma das
> posições a valor de mercado. `investment_transactions` **não** mexem em `saldoAtual`.

Isso mantém investimentos independentes da transferência. Em 23/09/2026 a transferência
passou a creditar a conta destino, mas com esta regra um crédito numa conta de investimento
seria sobrescrito pelo saldo derivado. Ao implementar esta fase, decidir se o aporte é uma
transferência para a conta de investimento (e o `saldoAtual` dela deixa de ser derivado) ou
se a transferência para conta de investimento deve ser recusada e o aporte continua sendo a
compra do ativo mais a saída lançada à parte.

### 6.4 Cotações

Job diário busca `asset_quotes` para ativos com `fonteCotacao = 'brapi'`;
`manual` fica a cargo do usuário (útil para renda fixa e CDB).

[brapi.dev](https://brapi.dev/docs) cobre ações, FIIs, BDRs e Tesouro Direto. Tem
[sandbox gratuito sem token](https://brapi.dev/blog/acesso-gratuito-ilimitado-acoes-teste-brapi)
com PETR4, VALE3, MGLU3, ITUB4 e ativos de teste de FII e Tesouro — suficiente para
construir e validar a integração inteira antes de assinar qualquer plano.

### 6.5 Endpoints

| Método | Rota | Observação |
|---|---|---|
| GET | `/investments/positions` | posição consolidada: quantidade, preço médio, cotação, valor de mercado, rentabilidade |
| GET | `/investments/transactions` | `{ data: [...] }`, paginado |
| POST | `/investments/transactions` | |
| DELETE | `/investments/transactions/:id` | recalcula a posição |
| GET | `/assets?q=` | busca no catálogo |
| POST | `/assets` | ativo customizado do usuário |

**Fora de escopo na v1:** rentabilidade ponderada por tempo (TWR) e XIRR, apuração de IR e
DARF, day trade, proventos provisionados automaticamente, e ativos em moeda estrangeira com
conversão. A v1 responde "quanto tenho, quanto paguei e quanto rendeu" — nada além disso.

---

## 7. Decisões em aberto

Precisam de resposta antes da fase correspondente:

| # | Questão | Fase |
|---|---|---|
| 1 | ~~Confirmar uma parcela deve ser manual, ou o pagamento da fatura confirma todas de uma vez?~~ **Decidido em 23/09/2026: o pagamento confirma todas de uma vez** (§3.3) | 3 |
| 2 | ~~Pagamento parcial de fatura: rolar ou proibir?~~ **Decidido em 23/09/2026: proibido.** O pagamento é sempre do valor total da fatura (§3.3) | 3 |
| 3 | ~~Categoria do pagamento da fatura~~ **Decidido em 23/09/2026: sem categoria** — as compras já estão categorizadas | 3 |
| 4 | ~~Janela de sugestão: 6 ou 12 meses?~~ **Decidido em 23/09/2026: 6 meses**, com as esporádicas olhando 12, como a spec assumia | 4 |
| 5 | Vale trazer o [Meu Pluggy](https://www.pluggy.ai/meu-pluggy) — Open Finance gratuito por tempo indeterminado para uso pessoal — antes ou depois dos investimentos? Elimina digitação manual, que é o que mata app de finanças pessoais na prática | 6 |

---

## 8. Fases e ordem de implementação

| Fase | Conteúdo | Depende de | Entrega ao usuário |
|---|---|---|---|
| **0** | ~~Timezone por usuário; refresh de token no frontend; backup do Postgres~~ — concluída em 23/09/2026 | — | sessão não cai; datas corretas |
| **1** | ~~Previsto × realizado (§1)~~ — concluída em 23/09/2026, exceto a regra de cartão, que foi para a Fase 3: `confirmada` nos cálculos, `dataCompetencia` no orçamento, endpoints de confirmar/desconfirmar | 0 | lançar gasto futuro avulso |
| **2** | ~~Parcelamento (§2)~~ — concluída em 23/09/2026, sem cartão | 1 | "comprei em 12x" aparece nos próximos 12 meses |
| **3** | ~~Fatura de cartão (§3) + tela de cartões + regra do §1.2 para `cardId` e backfill do §3.4 + `cardId` no parcelamento~~ — concluída em 23/09/2026 | 2 | gasto de crédito no fluxo de caixa certo |
| **4** | Orçamento: rollover, campos derivados, sugestões (§5) | 1, 2 | **orçamento montado a partir do histórico** |
| **5** | Recorrências (§4) + projeção do dashboard usando previstos | 1 | contas fixas entram na projeção |
| **6** | Investimentos (§6) | — | carteira com preço médio e cotação |

A Fase 6 não depende de nenhuma outra e pode ser feita fora de ordem, se a prioridade mudar.

A Fase 4 é o objetivo declarado, mas depende da 1 e da 2: um orçamento que ignora as
parcelas já assumidas propõe tetos que já nascem estourados.

---

## 9. Migrations

Produção **não** usa `synchronize` — o schema vem de `src/database/migrations/`, aplicadas
manualmente (ver `modelo-de-dados.md`). Cada fase precisa da sua migration escrita à mão:

| Fase | Migration |
|---|---|
| 1 | índice `['userId', 'confirmada', 'data']` em `transactions` |
| 2 | `installment_purchases`; `transactions.installmentPurchaseId`, `.numeroParcela` |
| 3 | `card_invoices`; `transactions.cardInvoiceId` |
| 4 | `budgets`: `+rollover`, `+saldoAnterior`, `−gastoAtual` |
| 5 | `recurring_rules`; `transactions.recurringRuleId` + índice único `['recurringRuleId','data']`; remover `recorrenciaGrupoId` e `proximoVencimento` |
| 6 | `assets`, `investment_transactions`, `asset_quotes` |

Dois lembretes que já custaram caro neste projeto:

1. **Todo valor monetário volta do Postgres como string.** `numeric` não é `number` no
   driver — `Number(...)` antes de qualquer conta, ou a soma vira concatenação.
2. **`frontend/types/index.ts` é escrito à mão e não deriva do backend.** Toda mudança de
   contrato aqui precisa atualizar `types/index.ts` e [`contrato-api.md`](./contrato-api.md)
   no mesmo commit. Três bugs em produção já vieram exatamente daí.
