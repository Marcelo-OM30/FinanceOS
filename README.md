# Finance OS — Plataforma de Inteligência Financeira Pessoal

MVP focado em modo pessoa física com gestão de contas, transações, orçamento e metas.

## 📁 Estrutura do Projeto

```
inteligenciaFinanceira/
├── backend/                          # API NestJS
│   ├── src/
│   │   ├── auth/                    # Autenticação e JWT
│   │   ├── users/                   # Gestão de usuários
│   │   ├── accounts/                # Contas bancárias
│   │   ├── cards/                   # Cartões
│   │   ├── transactions/            # Receitas e despesas
│   │   ├── categories/              # Categorias
│   │   ├── budgets/                 # Orçamentos
│   │   ├── goals/                   # Metas de economia
│   │   ├── alerts/                  # Alertas
│   │   ├── dashboard/               # Endpoints do dashboard
│   │   ├── common/                  # Guards, pipes, decorators
│   │   └── main.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/                         # App Next.js
│   ├── app/
│   │   ├── (auth)/                 # Páginas de autenticação
│   │   ├── dashboard/              # Dashboard principal
│   │   ├── accounts/               # Gestão de contas
│   │   ├── transactions/           # Transações
│   │   ├── budgets/                # Orçamentos
│   │   ├── goals/                  # Metas
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                     # Componentes reutilizáveis
│   │   ├── dashboard/              # Componentes do dashboard
│   │   ├── charts/                 # Gráficos
│   │   └── forms/                  # Formulários
│   ├── lib/
│   │   ├── api.ts                  # Cliente HTTP
│   │   ├── auth.ts                 # Utilitários de auth
│   │   └── utils.ts
│   ├── types/
│   │   └── index.ts                # TypeScript types
│   ├── styles/                      # CSS global + Tailwind
│   ├── public/                      # Imagens, ícones
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   └── tailwind.config.js
│
├── docs/
│   ├── planejamento19032026.md      # Planejamento geral
│   ├── especificacoes/
│   │   └── MODO_PESSOA_FISICA.md    # Spec funcional detalhada
│   └── arquitetura/
│       └── (diagramas em breve)
│
├── README.md                        # Este arquivo
├── .gitignore
└── docker-compose.yml               # (em breve)
```

---

## 🚀 Quick Start

### Pré-requisitos
- Node.js 18+
- npm ou yarn
- PostgreSQL 14+ (futuro)
- Redis (futuro)

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

Server roda em: `http://localhost:3000`

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

App roda em: `http://localhost:3001`

---

## 📋 Funcionalidades MVP — Modo Pessoa Física

✅ **Autenticação**
- Cadastro / Login com email
- JWT + Refresh token
- Recuperação de senha

✅ **Contas**
- Cadastrar múltiplas contas
- Visualizar saldo consolidado
- Editar / deletar

✅ **Cartões**
- Cadastrar cartões
- Associar a conta
- Visualizar limite

✅ **Transações**
- Lançar receitas e despesas
- Categorizar
- Editar / deletar
- Filtrar por período e categoria

✅ **Dashboard**
- Saldo consolidado
- Entradas vs saídas (mês)
- Gráfico por categoria
- Evolução mensal

✅ **Orçamento**
- Definir limite por categoria
- Alertas de estouro

✅ **Metas de Economia**
- Criar metas
- Acompanhar progresso
- Alertas

✅ **Projeções**
- Previsão de saldo fim do mês
- Baseada em gastos históricos

---

## 🏗️ Stack Técnico

### Backend
- **Framework:** NestJS
- **Runtime:** Node.js
- **Linguagem:** TypeScript
- **BD:** PostgreSQL
- **Cache:** Redis
- **Auth:** JWT

### Frontend
- **Framework:** Next.js 14
- **Linguagem:** TypeScript
- **UI:** React 18
- **Estilos:** Tailwind CSS
- **Gráficos:** Recharts / ECharts
- **State:** Zustand / Jotai
- **Forms:** React Hook Form

### Infraestrutura
- Docker / Docker Compose
- CI/CD (em breve)
- Deploy (em breve)

---

## 📖 Documentação

- [Planejamento do Projeto](./docs/planejamento19032026.md)
- [Especificação Modo Pessoa Física](./docs/especificacoes/MODO_PESSOA_FISICA.md)
- [Arquitetura](./docs/arquitetura/) (em breve)

---

## 🔄 Roadmap

**Fase MVP (Semana 1-6)**
- [ ] Setup backend + frontend
- [ ] Autenticação
- [ ] CRUD contas, transações, categorias
- [ ] Dashboard básico
- [ ] Gráficos
- [ ] Metas e orçamento
- [ ] Testes

**Fase MVP+ (Semana 7-12)**
- [ ] Importação de extratos (CSV, OFX)
- [ ] Automação de categorização
- [ ] Alertas avançados
- [ ] Projeções com IA
- [ ] Mobile responsivo

**Fase Empresarial (Depois)**
- [ ] Modo empresa
- [ ] Multiusuário
- [ ] Permissões
- [ ] Contas a pagar/receber

---

## 🤝 Contribuindo

(Em desenvolvimento)

---

## 📝 Licença

MIT

---

## 👤 Autor

Marcelo — 2026

