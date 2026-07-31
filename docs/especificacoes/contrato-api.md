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
| Objeto embrulhado `{ data: [...], ... }` | `GET /transactions`, `/dashboard/chart-categories`, `/dashboard/chart-evolution` |
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
separado, `JWT_REFRESH_SECRET`).

## Transações

| Método | Rota | Observação |
|---|---|---|
| GET | `/transactions` | paginado — ver query e resposta abaixo |
| GET | `/transactions/:id` | inclui `category`, `account`, `card` |
| POST | `/transactions` | ver DTO abaixo |
| PATCH | `/transactions/:id` | todos os campos opcionais |
| DELETE | `/transactions/:id` | 204, reverte o saldo da conta |

**Query de `GET /transactions`:** `accountId`, `categoryId`, `cardId`,
`dataInicio`, `dataFim`, `tipo`, `page` (1), `limit` (20).

**Resposta:** `{ data: Transaction[], total, page, limit }` ← **embrulhada**.

**Body de `POST /transactions`:**

| Campo | Tipo | Obrig. | Regra |
|---|---|---|---|
| `tipo` | string | ✅ | `receita` \| `despesa` \| `transferência` |
| `descricao` | string | ✅ | máx. 255 |
| `valor` | number | ✅ | mín. 0.01, 2 casas decimais |
| `data` | string | ✅ | ISO `YYYY-MM-DD` |
| `accountId` | uuid | ✅ | precisa pertencer ao usuário |
| `cardId` | uuid | | |
| `categoryId` | uuid | | |
| `dataCompetencia` | string | | ISO |
| `recurso` | string | | `manual` \| `importado` \| `bancário` |
| `recorrencia` | string | | `única` \| `semanal` \| `mensal` \| `anual` |
| `tags` | string[] | | |
| `numeroNota` | string | | máx. 50 |
| `confirmada` | boolean | | |

> **Não existe** campo `recorrente` (boolean). Enviar isso dá 400. O checkbox da
> interface é traduzido para `recorrencia`.

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
  "diasRestantes": 0, "taxaDiariaGasto": 0 }
```

> Não existe campo `tendencia`. E `diferenca` nunca é positiva, porque a projeção
> só soma despesas futuras — não tente derivar "tendência" dela.

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

`POST /cards` recebe `numero` em claro e grava criptografado; a resposta expõe
apenas `ultimosDigitos`.

## Categorias

`GET /categories` devolve **as globais (`userId` nulo) mais as do usuário**,
ordenadas por `tipo` e `nome`.

`POST /categories`: `nome` e `tipo` (`receita` | `despesa` | `ambos`)
obrigatórios; opcionais `descricao`, `icone`, `cor`, `categoriaPaiId`.

## Orçamentos

`GET /budgets?mes=&ano=` → `Budget[]`, cada um enriquecido com `gastoAtual`,
`percentualUtilizado`, `emAlerta`, `estourado`.

`POST /budgets`: `categoryId`, `limiteMensal`, `mes`, `ano` obrigatórios;
`alertaPercentual` opcional (padrão 80).

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
