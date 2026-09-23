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

**Previsto × realizado** (desde 23/09/2026): `confirmada = false` é uma
transação **prevista** — agendada, ainda não aconteceu. Ela não mexe no saldo
e não entra nos totais do mês, nos gráficos nem no orçamento; entra só na
projeção. `POST /transactions/:id/confirmar` a torna realizada e aplica o valor
no saldo; `desconfirmar` faz o inverso. Na tela, o formulário tem "Já
aconteceu" (desmarca sozinho quando a data escolhida é futura), a lista marca
"Agendada" e tem um botão para confirmar, e há filtro por status.

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
2. ~~**`recorrencia` não gera nada.**~~ Resolvido em 23/09/2026 com contas
   recorrentes (§4b); `recorrencia` virou só rótulo e as colunas
   `recorrenciaGrupoId`/`proximoVencimento` foram removidas.
3. **Sem edição no frontend.** `PATCH /transactions/:id` está implementado e
   testado no backend, mas a interface só permite criar e excluir.
4. **`reconciliada` não é usada.** `confirmada` passou a valer em 23/09/2026
   (previsto × realizado, ver abaixo).

## 4a. Parcelamentos (`installment_purchases`)

Desde 23/09/2026. Uma compra parcelada gera **todas** as parcelas na hora,
como transações de despesa: descrição "Notebook (3/12)", vencimentos mensais a
partir do primeiro (dia inexistente cai no último dia do mês: 31/01 → 28/02),
`dataCompetencia` = data da compra. As já vencidas nascem realizadas e saem do
saldo — dá para cadastrar uma compra em andamento —, as futuras nascem
previstas e entram na projeção.

A soma das parcelas é sempre exatamente o total: o resíduo do arredondamento
vai na primeira (R$ 100 em 3x = 33,34 + 33,33 + 33,33). Por isso uma parcela
não pode ser excluída nem ter valor, data ou conta alterados sozinha; só
categoria, descrição e confirmação. Renegociar é cancelar e recadastrar.

Cancelar exclui as parcelas previstas e mantém as pagas. Confirmar a última
parcela quita o parcelamento. Tela própria em "Parcelamentos", com progresso,
quanto falta e o próximo vencimento.

**Limitações:** ainda não aceita cartão — até a fatura existir (Fase 3), a
compra no cartão é cadastrada na conta que paga a fatura, com o dia de
vencimento dela. Como o orçamento conta só o realizado, no mês da compra ele
mostra apenas as parcelas já pagas; o total comprometido entra na Fase 4.

## 4b. Contas recorrentes (`recurring_rules`)

Desde 23/09/2026. Tela "Recorrentes": aluguel, salário, assinaturas — receita
ou despesa, semanal, mensal ou anual, na conta ou no cartão (cada ocorrência
vira compra na fatura). As ocorrências são transações **previstas** mantidas
sempre para os próximos 12 meses: criar a regra já as gera, e o backend confere
a janela no boot e a cada 6 horas, sem duplicar. Aparecem em Transações como
"Agendada", na projeção e no "comprometido" do orçamento; salário recorrente
entra na renda das sugestões.

Confirmar uma ocorrência pergunta o valor real. Com "valor variável" (luz,
água), a previsão é a média das 3 últimas confirmadas. Excluir uma ocorrência é
"este mês não teve" — ela não volta. Pausar ou excluir a regra remove as
previsões de hoje em diante e mantém o que já aconteceu. No formulário de
transação, "Repetir todo mês" cria a regra a partir do mês seguinte.

## 4c. Investimentos (`assets`, `investment_transactions`, `asset_quotes`)

Desde 23/09/2026. A conta de tipo **investimento** é o caixa da corretora: o
dinheiro entra por transferência da conta corrente, e a tela de Investimentos
registra compra, venda, dividendo, JCP, rendimento e taxa — compra e taxa saem
do caixa, venda e proventos entram. A carteira mostra, por ativo, quantidade,
preço médio (custo médio ponderado com taxas; venda não muda o preço médio),
cotação, valor de mercado, resultado em aberto e percentual, além de lucro
realizado e proventos.

Vender mais do que se tinha **naquela data** é recusado, e excluir uma compra
que deixaria uma venda posterior descoberta também. Cotações: brapi a cada 6
horas e no botão "Cotações" (sem `BRAPI_TOKEN`, só os ativos de teste da brapi,
como PETR4); qualquer ativo aceita cotação informada à mão (renda fixa é manual
por padrão). Sem cotação, o valor de mercado é o custo e a tela avisa. O card de
saldo do dashboard mostra, abaixo do saldo em conta, o total investido.

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
`mes`, `ano`, `alertaPercentual` (padrão 80) e `rollover` (o que acontece com o
saldo no mês seguinte).

A cada leitura o backend calcula, por competência (`COALESCE(dataCompetencia, data)`):

- `gastoRealizado` — despesas confirmadas da categoria no mês (`gastoAtual` é o
  mesmo valor, mantido por compatibilidade);
- `comprometido` — despesas previstas: agendadas, parcelas e compras no cartão
  com a fatura ainda não paga;
- `saldoAnterior` — o que vem do mês anterior, segundo o `rollover` **dele**:
  `nenhum` = 0; `acumula` = a sobra, nunca negativa; `ajustado` = sobra ou
  estouro, com piso: estouro acima de 2× o limite deixa R$ 1 disponível.
  Calculado a cada leitura, não gravado;
- `disponivel` = `limite + saldoAnterior − realizado − comprometido`;
- `percentualUtilizado` (só o realizado, como sempre) e `percentualComprometido`;
- `emAlerta` e `estourado`, sobre `percentualUtilizado`.

**Montar pelo histórico** (desde 23/09/2026): `GET /budgets/sugestoes` propõe um
teto por categoria para o mês escolhido, olhando os 6 meses fechados anteriores
(nunca o mês corrente, incompleto) e só o realizado. Fixa (≥ 5 meses, variação
≤ 15%) → média dos meses com gasto; variável (≥ 3 meses) → mediana dos 6, que
ignora um mês atípico; esporádica (≤ 2) → total de 12 meses ÷ 12, para IPVA e
seguro não estourarem o mês do vencimento. Se o que já está agendado para o mês
for maior, a sugestão sobe até ele. A tela mostra a renda típica (mediana das
receitas dos 6 meses), o total orçado e quanto sobra "a alocar"; o usuário
ajusta cada valor ("sugerido" ou "com folga" = p75), escolhe o rollover e aplica
— categoria que já tem orçamento no mês é atualizada. A tela navega por mês.

Despesa sem categoria não entra nas sugestões, porque não há onde orçá-la.

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
| `projection` | projeção de saldo até o fim do mês |

Todos somam só transações realizadas (`confirmada = true`). `summary` e
`chart-evolution` usam `data` (caixa); `chart-categories` usa
`COALESCE(dataCompetencia, data)` (competência), como o orçamento.

A projeção soma duas partes: o gasto do dia a dia, extrapolado por
`taxaDiaria = despesas realizadas do mês até hoje / dia atual`, e o que está
agendado, pelo valor exato: `saldoAtual + receitas previstas − despesas
previstas − taxaDiaria × dias restantes`. Previstas atrasadas (data passada,
ainda não confirmadas) entram, porque ainda não saíram do saldo. Receita só
entra na projeção se estiver agendada.

**Fuso horário** (resolvido em 23/09/2026): "hoje" e "mês atual" saem do
`timezone` do usuário (padrão `America/Sao_Paulo`), via
`backend/src/common/datas.ts`, e não mais do relógio do servidor, que roda em
UTC — entre 21h e a meia-noite o servidor já virou o dia, e no último dia do
mês, o mês. Vale para resumo, gráficos, projeção, dias restantes das metas e a
data padrão de um progresso de meta (antes era `CURRENT_DATE` do banco, também
em UTC). Fuso inválido cai no padrão; `PATCH /users/profile` recusa fuso que
não seja IANA. Não há tela para trocar o fuso (§11).

## 9. Alertas (`alerts`)

Existe a entidade, o serviço (`create`, `findAll`, `markAsRead`, `markAllAsRead`,
`countUnread`) e o controller REST completo.

**Lacuna:** `AlertsService.create()` **nunca é chamado por ninguém**. Nenhum
alerta é gerado — não quando um orçamento estoura, não quando uma meta entra em
risco, nunca. O contador `alertasNaoLidos` do dashboard será sempre 0, e não
existe tela para listar alertas. O módulo está inteiro morto.

## 10. Cartões e faturas (`cards`, `card_invoices`)

Desde 23/09/2026 há tela de Cartões. O cadastro pede só os **4 últimos
dígitos** — o número completo não é mais aceito nem guardado (cartões antigos
podem ter `numeroCriptografado`, e por isso `CARD_ENCRYPTION_KEY` continua
obrigatória). Só cartão de **crédito** recebe compras, e ele precisa de dia de
fechamento e de vencimento (1 a 28).

**Compra no cartão** (formulário de transação, opção "Cartão de crédito", ou
parcelamento): entra na fatura cujo fechamento é no dia da compra ou depois.
Ela **não mexe no saldo**; fica prevista, com `data` = vencimento da fatura
(quando o dinheiro sai) e `dataCompetencia` = dia da compra. Parcelado no
cartão: cada parcela cai uma fatura depois da anterior. A fatura nasce com a
primeira compra e some se ficar aberta e vazia.

**Pagar a fatura** debita o total da conta escolhida — uma transferência sem
destino, "Fatura Nubank 09/2026", fora dos totais de receita e despesa porque
as compras já contam — e confirma todas as compras de uma vez; parcelamentos
cuja última parcela foi paga ficam quitados. Pagamento parcial não existe.
"Desfazer" devolve o valor e reabre a fatura.

Proteções: compra não se confirma sozinha; não muda de data, conta ou cartão
(exclua e lance de novo); com a fatura paga, não pode ser excluída nem mudar
de valor; o pagamento só se desfaz pela fatura; nada entra numa fatura paga;
cartão com compras não pode ser excluído, só desativado.

**Consequência a conhecer:** gráfico de categorias e orçamento contam só o
realizado, então uma compra no cartão só aparece neles depois que a fatura é
paga. O "comprometido" entra na Fase 4 da spec.

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
4. ~~Recorrência não gera transações futuras (§4)~~ — resolvido em 23/09/2026
5. Cartões e perfil sem interface (§10, §11)
6. Sem edição de transação na interface (§4)

**Risco**

7. ~~Chave de criptografia com default hardcoded (§10)~~ — resolvido em 23/09/2026
8. Saldo por efeito colateral, sem reconciliação (§3)
9. ~~Cálculos de mês em UTC, ignorando o timezone do usuário (§8)~~ — resolvido em 23/09/2026

---

> As lacunas 4 (recorrência não gera transações futuras) e 6, mais a ausência de
> parcelamento, fatura de cartão e investimentos, são endereçadas em
> [`spec-orcamento-parcelas-investimentos.md`](./spec-orcamento-parcelas-investimentos.md).
