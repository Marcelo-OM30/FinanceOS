# Contrato da API — FinanceOS

> **Por que este documento existe:** os tipos TypeScript do frontend são escritos
> à mão e não derivam do backend. Já causaram três bugs em produção — campos com
> nome diferente dos dois lados, e respostas embrulhadas em `{ data }` que o
> frontend lia como array. O compilador não pega nada disso. **Ao mexer em um
> endpoint, atualize esta tabela e `frontend/types/index.ts` junto.**

- **Base URL:** `/api/v1` (prefixo global definido em `main.ts`)
- **Produção:** `https://backend-production-f495.up.railway.app/api/v1`
- **Autenticação:** `Authorization: Bearer <accessToken>` em tudo, exceto
  `/auth/*` e `/health`
- **Validação:** `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted`
  e `transform`

## ⚠️ `forbidNonWhitelisted` — a armadilha número um

Qualquer propriedade enviada que **não exista no DTO** faz a requisição inteira
falhar com **400** e a mensagem `property <nome> should not exist`. Não é um
aviso, não é ignorado silenciosamente: derruba o request.

Consequência prática: **nunca faça `api.post(url, { ...formData })`.** O objeto
do formulário quase sempre tem campos de UI que o DTO não conhece. Monte o
payload campo a campo, ou remova explicitamente o que não vai.

## Formato das respostas — não é uniforme

Três formatos convivem. Confira qual antes de consumir:

| Formato | Endpoints |
|---|---|
| Array puro `[...]` | `GET /accounts`, `/cards`, `/categories`, `/budgets`, `/goals`, `/alerts` |
| Objeto embrulhado `{ data: [...], ... }` | `GET /transactions`, `/installments`, `/card-invoices`, `/dashboard/chart-categories`, `/dashboard/chart-evolution` |
| Objeto simples | `/dashboard/summary`, `/dashboard/projection`, `/users/profile`, e todo `GET/POST/PATCH` de item único |

Uniformizar isso é uma dívida técnica conhecida. Enquanto não for feito, o
frontend precisa desembrulhar caso a caso.

---

## Auth

| Método | Rota | Body | Resposta |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password, nome }` | `{ user: { id, email, nome }, accessToken, refreshToken }` |
| POST | `/auth/login` | `{ email, password }` | idem acima |
| POST | `/auth/refresh` | `{ refreshToken }` | idem acima |

`accessToken` expira em **15 min**; `refreshToken`, em **7 dias** (segredo
separado, `JWT_REFRESH_SECRET`). `/auth/refresh` devolve um `refreshToken` novo a
cada chamada e responde **401** para token inválido, expirado ou de usuário
removido (login e cadastro respondem 400 nos erros).

## Transações

| Método | Rota | Observação |
|---|---|---|
| GET | `/transactions` | paginado — ver query e resposta abaixo |
| GET | `/transactions/:id` | inclui `category`, `account`, `card` |
| POST | `/transactions` | ver DTO abaixo |
| PATCH | `/transactions/:id` | todos os campos opcionais |
| POST | `/transactions/:id/confirmar` | prevista → realizada, aplica no saldo. 409 se já confirmada |
| POST | `/transactions/:id/desconfirmar` | realizada → prevista, tira do saldo. 409 se já prevista |
| DELETE | `/transactions/:id` | 204, reverte o saldo da conta (das duas, em transferência); prevista não mexe em saldo |

**Query de `GET /transactions`:** `accountId`, `categoryId`, `cardId`,
`dataInicio`, `dataFim`, `tipo`, `confirmada` (`true` \| `false`; omitido =
ambas), `page` (1), `limit` (20). `accountId` casa com a origem **ou** com o
destino da transferência.

**Resposta:** `{ data: Transaction[], total, page, limit }` ← **embrulhada**.
Cada item traz `account`, `contaDestino` (null fora de transferência), `category` e `card`.

**Body de `POST /transactions`:**

| Campo | Tipo | Obrig. | Regra |
|---|---|---|---|
| `tipo` | string | ✅ | `receita` \| `despesa` \| `transferência` |
| `descricao` | string | ✅ | máx. 255 |
| `valor` | number | ✅ | mín. 0.01, 2 casas decimais |
| `data` | string | ✅ | ISO `YYYY-MM-DD` |
| `accountId` | uuid | ✅ | precisa pertencer ao usuário; em transferência, é a origem |
| `contaDestinoId` | uuid | só em transferência | do usuário e diferente de `accountId`; em outro tipo dá 400 |
| `cardId` | uuid | | proibido em transferência |
| `categoryId` | uuid | | |
| `dataCompetencia` | string | | ISO |
| `recurso` | string | | `manual` \| `importado` \| `bancário` |
| `recorrencia` | string | | `única` \| `semanal` \| `mensal` \| `anual` |
| `tags` | string[] | | |
| `numeroNota` | string | | máx. 50 |
| `confirmada` | boolean | | padrão `true`. `false` = prevista: não mexe no saldo nem nos totais do mês até ser confirmada |

> **Não existe** campo `recorrente` (boolean). Enviar isso dá 400. O checkbox da
> interface é traduzido para `recorrencia`.

## Parcelamentos

| Método | Rota | Observação |
|---|---|---|
| GET | `/installments` | `{ data: [...] }` ← **embrulhada**. Query `status` (`ativa` \| `quitada` \| `cancelada`). Itens com `cardId` quando no cartão |
| GET | `/installments/:id` | inclui `parcelas: Transaction[]`, ordenadas por `numeroParcela` |
| POST | `/installments` | cria a compra e todas as parcelas; devolve como o GET de item |
| PATCH | `/installments/:id` | **só** `descricao` e `categoryId` (propaga para as parcelas) |
| DELETE | `/installments/:id` | 204. Cancela: exclui as parcelas previstas, mantém as pagas |

**Body de `POST /installments`:** `descricao` (máx. 240), `valorTotal` (mín.
0.02, 2 casas), `numeroParcelas` (2 a 120), `dataCompra`, `primeiroVencimento`
(não antes da compra), `accountId`, `categoryId?` — ou `cardId` no lugar de
`accountId` e `primeiroVencimento`. 400 se sobrar menos de um centavo por parcela.

**Cada item:** colunas da tabela — `valorTotal` e `valorParcela` chegam como
**texto** (decimal) — mais os calculados, já numéricos: `parcelasPagas`,
`parcelasRestantes`, `valorPago`, `saldoDevedor`, `proximoVencimento` (ou
`null`).

As parcelas são transações comuns com `installmentPurchaseId` e
`numeroParcela`. Nelas, `DELETE /transactions/:id` dá 409 e `PATCH` que mexa em
`valor`, `tipo`, `data`, `dataCompetencia`, `accountId`, `cardId` ou
`contaDestinoId` dá 400. Confirmar a última prevista marca o parcelamento como
`quitada`; desconfirmar volta para `ativa`; em parcelamento cancelado,
`desconfirmar` dá 409.

## Dashboard

**`GET /dashboard/summary`**

```json
{ "saldoConsolidado": 0, "totalEntradasMes": 0, "totalSaidasMes": 0,
  "resultadoMes": 0, "alertasNaoLidos": 0 }
```

> Os nomes são `totalEntradasMes` / `totalSaidasMes` / `resultadoMes` — **não**
> `entradasMes` / `saidasMes` / `resultado`. Essa confusão zerou três cards do
> dashboard em produção.

**`GET /dashboard/chart-categories`** → `{ data: [...], total }` ← **embrulhada**

Cada item: `{ categoria, cor, valor, percentual }`. O campo do valor chama-se
`valor`, não `total` — `total` é a soma geral, fora do array.

**`GET /dashboard/chart-evolution?meses=6`** → `{ data: [...] }` ← **embrulhada**

Cada item: `{ mes, mesNumero, ano, receitas, despesas, saldo }`. `meses` aceita
1 a 24.

**`GET /dashboard/projection`**

```json
{ "saldoAtual": 0, "saldoProjetadoFimMes": 0, "diferenca": 0,
  "diasRestantes": 0, "taxaDiariaGasto": 0,
  "previstoEntradas": 0, "previstoSaidas": 0 }
```

`saldoProjetadoFimMes = saldoAtual + previstoEntradas − previstoSaidas −
taxaDiariaGasto × diasRestantes`. `previsto*` somam as transações previstas com
`data` até o fim do mês, inclusive as atrasadas. `diferenca` pode ser positiva
quando há receita agendada.

> Não existe campo `tendencia`.

## Contas e cartões

| Método | Rota | Resposta |
|---|---|---|
| GET | `/accounts` | `Account[]` |
| GET | `/accounts/:id` | `Account` |
| POST | `/accounts` | `Account` |
| PATCH | `/accounts/:id` | `Account` |
| DELETE | `/accounts/:id` | 204 |
| GET | `/accounts/:id/cards` | `Card[]` |
| GET | `/cards`, `/cards/:id` | `Card` / `Card[]` |
| POST/PATCH/DELETE | `/cards`, `/cards/:id` | `Card` / 204 |

`POST /accounts`: `nome` e `tipo` obrigatórios; opcionais `banco`, `agencia`,
`numeroConta`, `saldoInicial`, `moeda`, `dataAbertura`, `cor`.

`POST /cards`: `accountId`, `nome`, `tipo` (`crédito` \| `débito` \|
`pré-pago`), opcionais `ultimosDigitos` (exatamente 4 dígitos), `bandeira`,
`limite`, `dataFechamentoFatura` e `vencimentoFatura` (1 a 28). **Não aceita
`numero`** desde 23/09/2026 (400). `DELETE` dá 409 se o cartão tem compras —
desative com `PATCH { ativo: false }`. `PATCH` não muda `tipo` de cartão com
compras.

### Faturas

| Método | Rota | Observação |
|---|---|---|
| GET | `/card-invoices` | `{ data: [...] }` ← **embrulhada**, mais recente primeiro. Query `cardId` |
| GET | `/card-invoices/:id` | inclui `transacoes` (com `category`), por data da compra |
| POST | `/card-invoices/:id/pagar` | `{ accountId, data? }` (padrão hoje). Sempre o total. 409 se já paga; 400 se vazia |
| POST | `/card-invoices/:id/desfazer-pagamento` | 409 se não está paga |

Não há POST de fatura: ela nasce com a primeira compra. Cada fatura: `mes`,
`ano` (do fechamento), `dataFechamento`, `dataVencimento`, `valorTotal`
(**texto**), `status` (`aberta` \| `fechada` \| `paga` — `fechada` é calculado:
aberta com o fechamento já passado), `pagamentoTransactionId`, `card`.

**Compra no cartão via `POST /transactions`:** mande `cardId` (cartão de
crédito) com `tipo: 'despesa'`; `data` é o **dia da compra**. A resposta volta
com `data` = vencimento da fatura, `dataCompetencia` = dia da compra,
`confirmada: false`, `cardInvoiceId` e `accountId` = conta do cartão.
`confirmada: true` no payload dá 400. `confirmar`/`desconfirmar` dão 409. `PATCH`
que mexa em `tipo`, `data`, `dataCompetencia`, `accountId`, `cardId` ou
`contaDestinoId` dá 400; `valor` com a fatura paga, 409. O pagamento da fatura
(uma transferência sem destino) dá 409 em `PATCH` e `DELETE`.

`POST /installments` aceita `cardId` no lugar de `accountId` e
`primeiroVencimento`.

## Categorias

`GET /categories` devolve **as globais (`userId` nulo) mais as do usuário**,
ordenadas por `tipo` e `nome`.

`POST /categories`: `nome` e `tipo` (`receita` | `despesa` | `ambos`)
obrigatórios; opcionais `descricao`, `icone`, `cor`, `categoriaPaiId`.

## Orçamentos

`GET /budgets?mes=&ano=` → `Budget[]` (array puro). Além das colunas
(`limiteMensal` chega como **texto**; `rollover`), cada item traz, numéricos:
`gastoRealizado`, `gastoAtual` (= `gastoRealizado`, legado), `comprometido`,
`saldoAnterior`, `disponivel`, `percentualUtilizado` (só realizado),
`percentualComprometido`, `emAlerta`, `estourado`.

`POST /budgets`: `categoryId`, `limiteMensal`, `mes`, `ano` obrigatórios;
`alertaPercentual` (padrão 80) e `rollover` (`nenhum` \| `acumula` \|
`ajustado`, padrão `nenhum`) opcionais. 409 se a categoria já tem orçamento no mês.

**`GET /budgets/sugestoes?mes=&ano=`** (obrigatórios) — não grava nada:

```json
{ "periodo": { "mes": 10, "ano": 2026 },
  "janela": { "de": "2026-03", "ate": "2026-08" },
  "rendaPrevista": 6000, "totalSugerido": 3925, "aAlocar": 2075,
  "data": [ { "categoryId": "…", "categoria": "Mercado", "classe": "variavel",
              "sugerido": 1225, "media": 1666.67, "mediana": 1225, "p75": 1287.5,
              "mesesComGasto": 6, "comprometido": 0,
              "ajustadoPorCompromissos": false, "orcamentoExistente": null } ] }
```

`classe`: `fixa` \| `variavel` \| `esporadica`. `orcamentoExistente`:
`{ id, limiteMensal, rollover }` (número) ou `null`.

**`POST /budgets/aplicar-sugestoes`** `{ mes, ano, itens: [{ categoryId,
limiteMensal, rollover? }] }` — cria ou atualiza em uma transação e devolve os
orçamentos do mês, como o `GET`.

## Metas

| Método | Rota | Resposta |
|---|---|---|
| GET | `/goals` | `Goal[]` + `percentualProgresso`, `diasRestantes`, `emRisco` |
| POST | `/goals` | `nome`, `valorAlvo`, `dataInicio`, `dataFim` obrigatórios |
| GET | `/goals/:id/progress` | `GoalProgress[]` |
| POST | `/goals/:id/progress` | `{ valorAdicionado, dataRegistro? }` → meta atualizada |

Progresso só é aceito em metas com `status = 'ativa'`; ao atingir `valorAlvo` o
status vira `concluída`.

## Alertas

`GET /alerts?lido=&tipo=`, `PATCH /alerts/:id/mark-as-read`,
`PATCH /alerts/mark-all-read` (204).

> Nada no sistema **cria** alertas hoje. Esses endpoints sempre devolvem lista
> vazia. Ver §9 da especificação funcional.

## Perfil e saúde

`GET /users/profile`, `PATCH /users/profile` (`nome`, `avatarUrl`, `telefone`,
`moedaPadrao`, `timezone`, `preferenciaTema`), `DELETE /users/profile`.

`GET /health` — sem autenticação, usado pelo healthcheck do Railway.

## Erros

| Código | Quando |
|---|---|
| 400 | validação do DTO, campo desconhecido, regra de negócio (`Conta não encontrada`) |
| 401 | token ausente, inválido ou expirado — o frontend desloga |
| 404 | recurso inexistente ou de outro usuário |

O corpo segue o padrão do Nest: `{ statusCode, message, error }`, onde `message`
pode ser **string ou array de strings** — o frontend precisa tratar os dois.
