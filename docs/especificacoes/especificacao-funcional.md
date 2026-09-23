# Especificação Funcional — FinanceOS

> **Escopo deste documento:** descreve o sistema **como ele existe hoje** (31/07/2026),
> não o produto planejado. Para a visão de produto — incluindo o modo Pessoa Jurídica,
> que não foi implementado — veja [`../planejamento19032026.md`](../planejamento19032026.md).
> Cada seção termina com as lacunas conhecidas daquele módulo.

## 1. Visão geral

FinanceOS é uma aplicação web de finanças pessoais. Cada usuário tem contas
bancárias, lança transações nelas, classifica essas transações em categorias e
acompanha o resultado por meio de orçamentos mensais, metas e um dashboard.

Todo dado é **privado por usuário**: com exceção das categorias globais (ver §5),
toda consulta filtra por `userId`, extraído do JWT. Não existe compartilhamento,
organização ou multiusuário.

Idioma do domínio: os campos e valores são em **português** (`receita`, `despesa`,
`transferência`, `ativa`, `concluída`). Isso vale inclusive para os valores
gravados no banco — algo a considerar antes de qualquer internacionalização.

## 2. Autenticação e sessão

| Ação | Regra |
|---|---|
| Cadastro | e-mail único, senha com hash bcrypt, nome obrigatório |
| Login | devolve `user` (id, email, nome), `accessToken` e `refreshToken` |
| Access token | JWT, validade **15 minutos** |
| Refresh token | JWT assinado com segredo separado, validade **7 dias** |

O token é guardado em `localStorage` (chave `finance-os-auth`, via Zustand
persist) e injetado pelo interceptor do Axios como `Authorization: Bearer`.

**Renovação da sessão:** quando uma requisição volta 401, o interceptor de
resposta (`frontend/lib/api.ts`) chama `POST /auth/refresh` com o
`refreshToken`, grava o par novo na store e repete a requisição original. Se
várias requisições caem juntas (o dashboard dispara 4), todas esperam a mesma
renovação. Se o refresh falha, ou se a requisição repetida volta 401 de novo, a
store é limpa e a pessoa vai para `/login`. Cada refresh devolve também um
`refreshToken` novo, então a sessão só expira depois de **7 dias sem uso**.

O backend recusa access token usado como refresh e vice-versa, porque os
segredos são diferentes. Por isso `JWT_REFRESH_SECRET` é obrigatório: sem ele o
`@nestjs/jwt` cairia no `JWT_SECRET` sem avisar, e login e refresh falham com
erro em vez disso.

**Outras lacunas:** não há recuperação de senha, verificação de e-mail (a coluna
`emailVerificado` existe e nunca muda), nem logout no servidor — o logout é só
local, e um token vazado continua válido até expirar.

## 3. Contas (`accounts`)

Uma conta representa onde o dinheiro está: conta corrente, poupança,
investimento ou carteira. Campos relevantes: `nome`, `tipo`, `banco`,
`saldoInicial`, `saldoAtual`, `moeda` (padrão BRL), `cor`, `ativo`.

**Regra central — o saldo é derivado por efeito colateral.** `saldoAtual` começa
igual a `saldoInicial` e é recalculado a cada escrita de transação:

- criar transação: `receita` soma, qualquer outro tipo subtrai;
- editar: reverte o efeito antigo e aplica o novo, na mesma transação de banco;
- excluir: reverte o efeito.

Isso é rápido para ler, mas significa que **o saldo pode divergir da soma das
transações** se alguma escrita falhar no meio ou se alguém alterar dados direto no
banco. Não existe rotina de reconciliação nem recálculo a partir do histórico.

**Lacuna:** `@Index(['userId', 'numeroConta'], { unique: true })` é único mesmo
quando `numeroConta` é nulo. Em Postgres, múltiplos NULLs não colidem, então na
prática funciona — mas o índice não protege nada para quem não informa o número.

## 4. Transações (`transactions`)

O registro central. Campos: `tipo` (`receita` | `despesa` | `transferência`),
`descricao`, `valor`, `data`, `accountId` (obrigatório), `contaDestinoId`,
`categoryId`, `cardId`, `dataCompetencia`, `tags`, `numeroNota`, `recorrencia`,
`confirmada`.

Listagem paginada (padrão 20/página) com filtros por conta, categoria, cartão,
tipo e intervalo de datas. Ordenação: `data DESC`, depois `dataCriacao DESC`.
O filtro por conta inclui as transferências que chegam nela.

**Transferência** é dinheiro que muda de uma conta do usuário para outra conta
dele — desde 23/09/2026. Uma linha só: debita `accountId`, credita
`contaDestinoId` e **não entra em nenhum total de receita ou despesa**, porque
o patrimônio não muda. Destino obrigatório, diferente da origem, do mesmo
usuário; não aceita `cardId`. PIX para outra pessoa não é transferência, é
despesa. As transferências gravadas antes disso têm `contaDestinoId` nulo e
continuam só debitando a origem — que é o que já tinham feito, então os saldos
não precisaram de correção. Pagar fatura de cartão ainda não é representável:
depende da fatura existir (spec de orçamento, §3).

**Lacunas relevantes:**

1. ~~**`transferência` não transfere.**~~ Resolvido em 23/09/2026 (ver acima).
2. **`recorrencia` não gera nada.** O campo é gravado (`mensal` quando o usuário
   marca o checkbox), mas nenhum código cria as ocorrências futuras. As colunas
   `recorrenciaGrupoId` e `proximoVencimento` existem e nunca são preenchidas.
3. **Sem edição no frontend.** `PATCH /transactions/:id` está implementado e
   testado no backend, mas a interface só permite criar e excluir.
4. **`confirmada` e `reconciliada` não são usadas.** Nenhuma tela lê ou escreve
   esses campos, e os cálculos do dashboard ignoram os dois — ou seja, uma
   transação não confirmada entra nos totais como qualquer outra.

## 5. Categorias (`categories`)

Categorias podem ser **globais** (`userId` nulo, criadas pelo seed e visíveis para
todos) ou **do usuário**. A listagem devolve a união das duas.

`tipo` restringe onde a categoria aparece: `receita`, `despesa` ou `ambos`.
Existe `categoriaPaiId` para hierarquia, **sem uso** na interface.

**Lacuna:** o índice único é `['userId', 'nome']`. Como as globais têm `userId`
nulo, um usuário consegue criar uma categoria com o mesmo nome de uma global, e
as duas aparecem juntas na lista sem nada que as distinga.

## 6. Orçamentos (`budgets`)

Um orçamento é um teto de gasto para uma categoria em um mês/ano: `limiteMensal`,
`mes`, `ano`, `alertaPercentual` (padrão 80).

A cada leitura o backend enriquece o registro:

- `gastoAtual` — soma das despesas daquela categoria no mês (calculada na hora);
- `percentualUtilizado` — `gastoAtual / limiteMensal`, arredondado;
- `emAlerta` — `percentualUtilizado >= alertaPercentual` e `< 100`;
- `estourado` — `percentualUtilizado >= 100`.

A coluna `gastoAtual` da tabela existe mas é ignorada na leitura — o valor exibido
vem sempre do cálculo. Vale removê-la para não induzir a erro.

**Lacuna:** estourar um orçamento não dispara nada além da cor na tela (ver §9).

## 7. Metas (`goals`)

Meta de acúmulo: `nome`, `valorAlvo`, `valorAtual`, `dataInicio`, `dataFim`,
`prioridade`, `status` (`ativa` | `pausada` | `concluída` | `cancelada`).

`POST /goals/:id/progress` adiciona um valor, grava um snapshot em
`goal_progress` e, ao atingir `valorAlvo`, muda o status para `concluída`.
Só metas `ativa` aceitam progresso.

Campos derivados na leitura: `percentualProgresso` (teto de 100),
`diasRestantes` e `emRisco` — este último quando a meta está ativa, já passou de
70% do tempo e está abaixo de 80% do valor.

**Lacuna:** o progresso é desconectado das transações. Guardar dinheiro de fato
(uma transação) não move a meta; é preciso registrar o progresso à mão.

## 8. Dashboard

Quatro endpoints, todos restritos ao mês corrente (exceto a evolução):

| Bloco | Conteúdo |
|---|---|
| `summary` | saldo consolidado das contas ativas, entradas e saídas do mês, resultado, alertas não lidos |
| `chart-categories` | despesas do mês agrupadas por categoria, com percentual |
| `chart-evolution` | receitas × despesas dos últimos N meses (padrão 6) |
| `projection` | projeção linear de saldo até o fim do mês |

A projeção usa uma regra simples: `taxaDiaria = despesas do mês até hoje / dia
atual`, e projeta `saldoAtual - (taxaDiaria × dias restantes)`. Como só soma
despesas, **a projeção nunca é maior que o saldo atual** — não há previsão de
receitas futuras.

**Lacuna:** o mês é calculado com o relógio **do servidor** (UTC em produção),
enquanto o usuário está em `America/Sao_Paulo`. Entre 21h e a meia-noite, o
servidor já virou o dia — e, no último dia do mês, virou o mês. O campo
`timezone` do usuário existe no banco e não é consultado em nenhum cálculo.

## 9. Alertas (`alerts`)

Existe a entidade, o serviço (`create`, `findAll`, `markAsRead`, `markAllAsRead`,
`countUnread`) e o controller REST completo.

**Lacuna:** `AlertsService.create()` **nunca é chamado por ninguém**. Nenhum
alerta é gerado — não quando um orçamento estoura, não quando uma meta entra em
risco, nunca. O contador `alertasNaoLidos` do dashboard será sempre 0, e não
existe tela para listar alertas. O módulo está inteiro morto.

## 10. Cartões (`cards`)

CRUD completo no backend, com o número do cartão criptografado em AES-256-CBC
antes de gravar (`numeroCriptografado`) e apenas os `ultimosDigitos` em claro.

**Lacunas:** (a) não existe nenhuma tela de cartões no frontend — o módulo só é
alcançável via API; (b) a chave de criptografia cai em um **default hardcoded**
(`'default-encryption-key-change-in-prod'`) quando `CARD_ENCRYPTION_KEY` não está
definida, o que significa que um banco vazado é decifrável por qualquer um com
acesso ao código-fonte.

## 11. Perfil do usuário

`GET /users/profile`, `PATCH /users/profile` (nome, avatar, telefone, moeda,
timezone, tema) e `DELETE /users/profile`.

**Lacuna:** nenhuma tela consome esses endpoints. Não há página de configurações,
o que torna `timezone`, `moedaPadrao` e `preferenciaTema` inalcançáveis pela
interface — e, como visto em §8, o timezone não é usado nem internamente.

## 12. Resumo das lacunas, por prioridade

**Quebra o uso hoje**

1. ~~Sessão expira em 15 min sem refresh (§2)~~ — resolvido em 22/09/2026
2. ~~Transferência não credita conta destino (§4)~~ — resolvido em 23/09/2026

**Funcionalidade prometida que não existe**

3. Alertas nunca são gerados (§9)
4. Recorrência não gera transações futuras (§4)
5. Cartões e perfil sem interface (§10, §11)
6. Sem edição de transação na interface (§4)

**Risco**

7. Chave de criptografia com default hardcoded (§10)
8. Saldo por efeito colateral, sem reconciliação (§3)
9. Cálculos de mês em UTC, ignorando o timezone do usuário (§8)

---

> As lacunas 4 (recorrência não gera transações futuras) e 6, mais a ausência de
> parcelamento, fatura de cartão e investimentos, são endereçadas em
> [`spec-orcamento-parcelas-investimentos.md`](./spec-orcamento-parcelas-investimentos.md).
