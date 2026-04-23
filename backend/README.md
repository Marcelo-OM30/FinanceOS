# Frontend Backend Setup Guide

## 📋 Pré-requisitos

- Node.js 18+ instalado
- npm ou yarn
- PostgreSQL 14+ instalado e rodando

## 🚀 Instalação e Execução

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar ambiente

```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Ou use o de development (já configurado para desenvolvimento)
cp .env.development .env
```

### 3. Rodar em desenvolvimento

```bash
npm run start:dev
```

O servidor estará disponível em: **http://localhost:3000**

API Base URL: **http://localhost:3000/api/v1**

---

## 🛠️ Scripts disponíveis

```bash
# Desenvolvimento
npm run start:dev       # Roda com hot reload

# Produção
npm run build          # Compila TypeScript
npm run start:prod     # Inicia em produção

# Qualidade
npm run lint           # ESLint
npm run test           # Testes unitários
npm run test:watch     # Testes em watch mode
npm run test:cov       # Cobertura de testes
npm run test:e2e       # Testes end-to-end
```

---

## 📊 Estrutura de Pastas

```
backend/
├── src/
│   ├── main.ts                  # Entrada da aplicação
│   ├── app.module.ts            # Módulo raiz
│   │
│   ├── modules/
│   │   ├── auth/               # Autenticação
│   │   ├── users/              # Usuários
│   │   ├── accounts/           # Contas
│   │   ├── transactions/       # Transações
│   │   ├── categories/         # Categorias
│   │   ├── budgets/            # Orçamentos
│   │   ├── goals/              # Metas
│   │   └── dashboard/          # Dashboard
│   │
│   ├── config/
│   │   └── database.config.ts  # Configuração do banco
│   │
│   ├── common/                  # Guards, pipes, decorators
│   ├── database/                # Entities compartilhadas
│   └── utils/                   # Utilitários (future)
│
├── package.json
├── tsconfig.json
├── .env.example
├── .env.development
└── README.backend.md
```

---

## 🔐 Autenticação

### Endpoints

- `POST /api/v1/auth/register` - Cadastro
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Renovar token
- `GET /api/v1/users/profile` - Perfil (requer autenticação)

### Como usar

1. **Registre um usuário:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123",
    "nome": "João Silva"
  }'
```

2. **Faça login:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123"
  }'
```

3. **Use o token:**
```bash
curl -X GET http://localhost:3000/api/v1/users/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🗄️ Banco de Dados

### PostgreSQL Setup

Se você não tiver PostgreSQL instalado:

**Windows (com WSL):**
```bash
# No WSL
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start

# Criar usuário e banco
sudo -u postgres psql
> CREATE USER finance_user WITH PASSWORD 'finance_password_dev';
> ALTER ROLE finance_user SET client_encoding TO 'utf8';
> ALTER ROLE finance_user SET default_transaction_isolation TO 'read committed';
> ALTER ROLE finance_user SET default_transaction_deferrable TO on;
> ALTER ROLE finance_user SET timezone TO 'UTC';
> CREATE DATABASE finance_os_db OWNER finance_user;
> GRANT ALL PRIVILEGES ON DATABASE finance_os_db TO finance_user;
> \q
```

**macOS (com Homebrew):**
```bash
brew install postgresql
brew services start postgresql

# Criar usuário e banco
psql postgres
> CREATE USER finance_user WITH PASSWORD 'finance_password_dev';
> CREATE DATABASE finance_os_db OWNER finance_user;
> \q
```

### Verificar conexão

```bash
psql -U finance_user -d finance_os_db -h localhost
```

---

## 🧪 Testes

```bash
# Rodar testes
npm run test

# Watch mode
npm run test:watch

# Cobertura
npm run test:cov
```

---

## 🐛 Troubleshooting

### Erro: "Cannot find module"
```bash
npm install
```

### Erro: "Connection refused" (PostgreSQL)
- Verifique se PostgreSQL está rodando
- Verifique as credenciais em `.env`

### Erro: "Port 3000 already in use"
```bash
# Mudar a porta no .env
PORT=3001
```

### Compilação lenta
- Delete `node_modules` e `dist`
- Rode `npm install` novamente

---

## 📚 Documentação da API

Ver [docs/arquitetura/API.md](../docs/arquitetura/API.md) para documentação completa dos endpoints.

---

## 🚀 Deploy (Futuro)

Instruções para deploy virão em breve.

---

## 📝 Licença

MIT

