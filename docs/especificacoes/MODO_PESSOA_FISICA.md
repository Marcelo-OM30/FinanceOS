# Especificação Funcional — Modo Pessoa Física

## 1. Visão Geral

O Modo Pessoa Física é o MVP principal da plataforma Finance OS, focado em ajudar usuários a gerenciar suas finanças pessoais de forma inteligente e automatizada.

---

## 2. Funcionalidades Core

### 2.1. Contas Bancárias
- Cadastrar múltiplas contas
- Visualizar saldo de cada conta
- Saldo consolidado
- Histórico de saldos por período
- Editar e deletar contas
- Marcar contas como ativas/inativas

**Dados:**
- nome da conta
- tipo (corrente, poupança, investimento, etc)
- banco
- saldo inicial
- data de abertura
- moeda

---

### 2.2. Cartões
- Cadastrar múltiplos cartões
- Associar cartão a conta
- Visualizar transações do cartão
- Limite disponível
- Limite utilizado
- Data de vencimento
- Status (ativo, cancelado, bloqueado)

**Dados:**
- nome do cartão
- número (formato mascarado)
- bandeira
- tipo (débito, crédito, pré-pago)
- agência/banco
- limite
- vencimento da fatura
- status

---

### 2.3. Receitas e Despesas

#### Receitas
- Salário
- Freelance/Bicos
- Investimentos
- Outras receitas
- Transferências

#### Despesas
- Alimentação
- Transporte
- Saúde
- Educação
- Moradia
- Lazer
- Utilidades
- Pessoal
- Investimentos
- Outras

**Dados de transação:**
- tipo (receita/despesa)
- categoria
- subcategoria (opcional)
- valor
- data
- descrição
- conta/cartão origem
- recurso (manual, importação, bancária)
- recorrência (única, semanal, mensal, anual)
- tags (opcional)

---

### 2.4. Metas de Economia
- Criar metas (ex: "Economizar R$ 500 em 30 dias")
- Visualizar progresso (%)
- Alertas de andamento
- Risco de não atingir
- Histórico de metas (atingidas, não atingidas)

**Dados:**
- nome
- valor alvo
- valor atual
- data início
- data fim
- categoria associada
- prioridade
- status (ativa, pausada, concluída)

---

### 2.5. Orçamento por Categoria
- Definir limite de gasto por categoria
- Acompanhar execução em tempo real
- Alertas de estouro
- Comparação mês anterior
- Distribuição percentual

**Dados:**
- categoria
- limite mensal
- gasto atual
- percentual utilizado
- período

---

### 2.6. Gráficos e Visualizações

#### Dashboard Principal
- Saldo consolidado (destaque)
- Total entradas mês
- Total saídas mês
- Resultado do mês (ganho/perda)
- Gráfico de evolução mensal (últimos 6 meses)

#### Gráficos por Categoria
- Pizza: distribuição de gastos
- Barras: comparação mês a mês
- Linha: evolução de categoria no tempo

#### Cashflow
- Gráfico de fluxo de entrada vs saída
- Projeção de saldo
- Tendência

---

### 2.7. Projeções Financeiras

#### Previsão do Fim do Mês
- Baseada em gastos do mês até o momento
- Toma em conta despesas recorrentes
- Estima saldo final
- Aviso se saldo ficar negativo

#### Estimativa de Saldo Futuro
- Proyeta saldo para próximos 3/6 meses
- Considera tendências
- Baseada em média histórica

---

### 2.8. Alertas

#### Tipos de Alerta
- Estouro de orçamento
- Risco de saldo negativo
- Meta em risco
- Despesa incomum (valor alto)
- Transação recorrente não detectada

#### Canais
- In-app notification
- Email
- Push (futuro)

---

### 2.9. Comparação de Hábitos
- Gastos este mês vs mês anterior
- Gastos esta categoria vs média histórica
- Variação percentual
- Insights (ex: "Você gastou 18% a mais em alimentação")

---

### 2.10. Custo de Deslocamento (Futuro MVP+)
- Registrar despesas de combustível
- Calcular custo por km
- Comparar eficiência
- Sugerir otimizações

---

### 2.11. Postos de Gasolina (Futuro MVP+)
- Base de dados de postos
- Preços pró-ativos
- Sugestões do melhor preço
- Histórico de compras
- Economia potencial

---

### 2.12. Planejamento de Viagens (Futuro MVP+)
- Cadastrar viagem
- Estimar custos
- Rastrear gastos da viagem
- Comparar com orçamento
- Insights de custo por dia/pessoa

---

## 3. Fluxos de Usuário Principais

### 3.1. First Time User
1. Cadastro / Login
2. Criar conta principal
3. Adicionar saldo inicial
4. Adicionar cartões
5. Visualizar dashboard
6. Lançar primeira transação

### 3.2. Rotina Diária
1. Login
2. Visualizar dashboard
3. Adicionar transações (gastos do dia)
4. Verificar alertas
5. Logout

### 3.3. Planejamento Mensal
1. Revisar gastos do mês
2. Comparar com mês anterior
3. Ajustar orçamentos
4. Revisar metas
5. Planejar próximo mês

---

## 4. Requisitos Técnicos

### 4.1. Autenticação
- JWT com refresh token
- Recuperação de senha por email
- Logout completo

### 4.2. Segurança
- Criptografia de dados sensíveis (número do cartão, etc)
- Hash de senhas
- HTTPS obrigatório
- LGPD compliance

### 4.3. Performance
- Carregamento do dashboard < 2s
- Listagem de transações com paginação
- Cache inteligente

### 4.4. Responsividade
- Web desktop first
- Mobile responsive
- Tablets suportados

---

## 5. Estrutura de Dados

### User
- id, email, password_hash, nome, avatar
- data_criacao, ultimo_login, ativo

### Account
- id, user_id, nome, tipo, banco, saldo, moeda
- data_abertura, ativo

### Card
- id, user_id, account_id, nome, número (criptografado)
- tipo, bandeira, limite, vencimento, status

### Category
- id, nome, ícone, cor, tipo (receita/despesa)
- user_id (customizadas)

### Transaction
- id, user_id, account_id, category_id, tipo
- valor, data, descrição, recurso (manual/importado)
- recorrência, tags

### Budget
- id, user_id, category_id, limite_mensal
- periodo (mês/ano)

### Goal
- id, user_id, nome, valor_alvo, valor_atual
- data_inicio, data_fim, categoria_id, prioridade, status

### Alert
- id, user_id, tipo, mensagem, relativo_a_id (transaction, goal, etc)
- visualizado, data_criacao

---

## 6. APIs Essenciais

### Autenticação
- POST /auth/register
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- POST /auth/forgot-password

### Contas
- GET /accounts
- POST /accounts
- PUT /accounts/:id
- DELETE /accounts/:id
- GET /accounts/:id/balance-history

### Cartões
- GET /cards
- POST /cards
- PUT /cards/:id
- DELETE /cards/:id

### Transações
- GET /transactions (com filtros)
- POST /transactions
- PUT /transactions/:id
- DELETE /transactions/:id

### Categorias
- GET /categories
- POST /categories
- PUT /categories/:id
- DELETE /categories/:id

### Orçamentos
- GET /budgets
- POST /budgets
- PUT /budgets/:id
- DELETE /budgets/:id

### Metas
- GET /goals
- POST /goals
- PUT /goals/:id
- DELETE /goals/:id
- PATCH /goals/:id/update-progress

### Alertas
- GET /alerts
- PATCH /alerts/:id/mark-as-read

### Dashboard
- GET /dashboard/summary
- GET /dashboard/chart-categories
- GET /dashboard/chart-evolution
- GET /dashboard/projection

---

## 7. Priorização MVP

### Sprint 1-2: Base
- [ ] Autenticação
- [ ] CRUD de contas
- [ ] CRUD de transações
- [ ] CRUD de categorias
- [ ] Dashboard básico

### Sprint 3: Visualização
- [ ] Gráficos por categoria
- [ ] Evolução mensal
- [ ] Metas básicas

### Sprint 4: Inteligência
- [ ] Orçamento
- [ ] Alertas de estouro
- [ ] Projeção de saldo

### Sprint 5: Polish
- [ ] Testes
- [ ] Performance
- [ ] Responsividade
- [ ] UX refinement

---

## 8. KPIs de Sucesso

- Dashboard carrega < 2s
- 95%+ disponibilidade
- Categorização automática acerta em 90%+
- Usuários retornam 3+ vezes/semana
- NPS > 50
- Churn < 5% ao mês

---

## 9. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Precisão de categorização | Alta | Validação manual inicial + ML |
| Segurança de dados | Crítica | Criptografia, audits regulares |
| Performance em muitos dados | Alta | Paginação, índices DB |
| Churn por falta de agilidade | Alta | MVP estreito e validação rápida |

