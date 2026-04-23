# Modelo de Dados — Finance OS

## Diagrama Relacional

```
User (1) ──┬─ (N) Account
           ├─ (N) Card
           ├─ (N) Category
           ├─ (N) Transaction
           ├─ (N) Budget
           ├─ (N) Goal
           ├─ (N) Alert
           └─ (N) AuditLog

Account (1) ─ (N) Card
Account (1) ─ (N) Transaction

Card (1) ─ (N) Transaction

Category (1) ─ (N) Transaction
Category (1) ─ (N) Budget
Category (1) ─ (N) Goal

Budget (por mês/categoria)
Goal (1) ─ (N) GoalProgress

Transaction ─ Category
Transaction ─ Account
Transaction ─ Card (nullable)
```

---

## Tabelas

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(255),
  telefone VARCHAR(20),
  documento VARCHAR(20), -- CPF/CNPJ
  data_nascimento DATE,
  
  -- Configurações
  moeda_padrao VARCHAR(3) DEFAULT 'BRL',
  timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
  preferencia_tema VARCHAR(20) DEFAULT 'light', -- light, dark
  
  -- Status
  ativo BOOLEAN DEFAULT true,
  email_verificado BOOLEAN DEFAULT false,
  
  -- Timestamps
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ultimo_login TIMESTAMP,
  
  -- Soft delete
  data_exclusao TIMESTAMP
);
```

### accounts
```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL, -- corrente, poupança, investimento, etc
  banco VARCHAR(100),
  agencia VARCHAR(10),
  numero_conta VARCHAR(20),
  
  saldo_inicial DECIMAL(15,2) DEFAULT 0,
  saldo_atual DECIMAL(15,2) DEFAULT 0,
  moeda VARCHAR(3) DEFAULT 'BRL',
  
  ativo BOOLEAN DEFAULT true,
  data_abertura DATE,
  
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, numero_conta)
);
```

### cards
```sql
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  
  nome VARCHAR(255) NOT NULL,
  numero_criptografado VARCHAR(255) NOT NULL, -- encrypted
  ultimos_digitos VARCHAR(4),
  
  tipo VARCHAR(20) NOT NULL, -- débito, crédito, pré-pago
  bandeira VARCHAR(50), -- visa, mastercard, elo, etc
  
  limite DECIMAL(15,2),
  limite_utilizado DECIMAL(15,2) DEFAULT 0,
  
  vencimento_fatura INT, -- dia do mês (1-28)
  data_fechamento_fatura INT, -- dia do mês
  
  ativo BOOLEAN DEFAULT true,
  data_abertura DATE,
  data_vencimento DATE,
  
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### categories
```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL = padrão do sistema
  
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  icone VARCHAR(50),
  cor VARCHAR(7), -- hex color
  
  tipo VARCHAR(20) NOT NULL, -- receita, despesa
  
  -- Categorias aninhadas (sub)
  categoria_pai_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  
  // Status
  customizada BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, nome)
);
```

### transactions
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  
  tipo VARCHAR(20) NOT NULL, -- receita, despesa, transferência
  
  descricao VARCHAR(255) NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  
  data VARCHAR(10) NOT NULL, -- YYYY-MM-DD
  data_competencia VARCHAR(10), -- para fatura de cartão
  
  recurso VARCHAR(50) DEFAULT 'manual', -- manual, importado, bancário
  
  -- Recorrência
  recorrencia VARCHAR(20), -- única, semanal, mensal, anual
  recorrencia_grupo_id UUID, -- para agrupar recorrências
  proximo_vencimento DATE,
  
  -- Tags
  tags VARCHAR[], -- array de tags
  
  // Metadata
  numero_nota VARCHAR(50),
  referencia_externa VARCHAR(255),
  
  // Status
  reconciliada BOOLEAN DEFAULT false,
  confirmada BOOLEAN DEFAULT true,
  
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_user_data ON transactions(user_id, data);
CREATE INDEX idx_transactions_categor_id ON transactions(category_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
```

### budgets
```sql
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  
  limite_mensal DECIMAL(15,2) NOT NULL,
  gasto_atual DECIMAL(15,2) DEFAULT 0,
  
  -- Período
  mes INT NOT NULL, -- 1-12
  ano INT NOT NULL,
  
  alerta_percentual INT DEFAULT 80, -- alertar quando atingir 80%
  
  ativo BOOLEAN DEFAULT true,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, category_id, mes, ano)
);
```

### goals
```sql
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  
  valor_alvo DECIMAL(15,2) NOT NULL,
  valor_atual DECIMAL(15,2) DEFAULT 0,
  
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  
  prioridade VARCHAR(20) DEFAULT 'media', -- baixa, média, alta
  status VARCHAR(20) DEFAULT 'ativa', -- ativa, pausada, concluída, não_atingida
  
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### goal_progress
```sql
CREATE TABLE goal_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  
  valor_adicionado DECIMAL(15,2) NOT NULL,
  percentual_progresso DECIMAL(5,2),
  
  data_registro DATE NOT NULL DEFAULT CURRENT_DATE,
  
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### alerts
```sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  tipo VARCHAR(50) NOT NULL, -- estouro_orcamento, risco_meta, despesa_incomum, saldo_baixo, etc
  
  mensagem TEXT NOT NULL,
  descricao TEXT,
  
  -- Relação com entidade
  entidade_tipo VARCHAR(50), -- transaction, budget, goal
  entidade_id UUID,
  
  severidade VARCHAR(20) DEFAULT 'info', -- info, warning, critical
  
  lido BOOLEAN DEFAULT false,
  data_leitura TIMESTAMP,
  
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_alert_descricao CHECK (tipo IS NOT NULL)
);
```

### audit_logs
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  acao VARCHAR(50) NOT NULL, -- create, update, delete, login, logout
  
  entidade_tipo VARCHAR(50), -- user, account, transaction, etc
  entidade_id UUID,
  
  valores_anteriores JSONB,
  valores_novos JSONB,
  
  endereco_ip VARCHAR(45),
  user_agent TEXT,
  
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user_data (user_id, data_criacao)
);
```

---

## Índices Importantes

```sql
CREATE INDEX idx_transactions_user_data ON transactions(user_id, data DESC);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_recorrencia ON transactions(recorrencia_grupo_id) WHERE recorrencia IS NOT NULL;

CREATE INDEX idx_budgets_user_mes_ano ON budgets(user_id, mes, ano);

CREATE INDEX idx_goals_user ON goals(user_id);

CREATE INDEX idx_alerts_user ON alerts(user_id) WHERE lido = false;

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
```

---

## Encrypted Fields

Os seguintes campos devem ser criptografados:
- `cards.numero_criptografado`
- Possibilidade de criptografar `users.documento`

---

## Integridade de Dados

- Saldo da account deve ser atualizado sempre que uma transaction é criada/atualizada/deletada
- Gasto atual do budget deve ser recalculado diariamente
- Alertas devem ser criados automaticamente quando limites são atingidos

