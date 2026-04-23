# API Documentation — Finance OS

Base URL: `http://localhost:3000/api/v1`

---

## 🔐 Authentication

### POST `/auth/register`
Criar nova conta.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "nome": "João Silva"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "nome": "João Silva",
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

---

### POST `/auth/login`
Fazer login.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "nome": "João Silva",
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

---

### POST `/auth/refresh`
Renovar accessToken.

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "eyJhbGc..."
}
```

---

### POST `/auth/logout`
Fazer logout.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`

---

### POST `/auth/forgot-password`
Solicitar recuperação de senha.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:** `200 OK`
```json
{
  "message": "Email de recuperação enviado"
}
```

---

## 💰 Contas

### GET `/accounts`
Listar suas contas.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "nome": "Conta Principal",
      "tipo": "corrente",
      "banco": "Banco do Brasil",
      "saldo_atual": 5000.50,
      "moeda": "BRL",
      "ativo": true,
      "data_abertura": "2024-01-01"
    }
  ],
  "total": 1
}
```

---

### POST `/accounts`
Criar nova conta.

**Request:**
```json
{
  "nome": "Conta Principal",
  "tipo": "corrente",
  "banco": "Banco do Brasil",
  "saldo_inicial": 1000.00,
  "moeda": "BRL"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "nome": "Conta Principal",
  "tipo": "corrente",
  "saldo_atual": 1000.00,
  "ativo": true
}
```

---

### GET `/accounts/:id`
Obter detalhes de uma conta.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "nome": "Conta Principal",
  "tipo": "corrente",
  "banco": "Banco do Brasil",
  "saldo_atual": 5000.50,
  "saldo_inicial": 1000.00,
  "ativo": true,
  "data_abertura": "2024-01-01"
}
```

---

### PUT `/accounts/:id`
Atualizar conta.

**Request:**
```json
{
  "nome": "Conta Atualizada",
  "ativo": true
}
```

**Response:** `200 OK`

---

### DELETE `/accounts/:id`
Deletar conta.

**Response:** `204 No Content`

---

## 💳 Cartões

### GET `/cards`
Listar cartões.

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "nome": "Visa Débito",
      "ultimos_digitos": "1234",
      "tipo": "débito",
      "bandeira": "visa",
      "limite": 5000.00,
      "ativo": true
    }
  ]
}
```

---

### POST `/cards`
Criar cartão.

**Request:**
```json
{
  "nome": "Visa Crédito",
  "numero": "4532123456789010",
  "tipo": "crédito",
  "bandeira": "visa",
  "account_id": "uuid",
  "limite": 5000.00,
  "vencimento_fatura": 10
}
```

**Response:** `201 Created`

---

## 💸 Transações

### GET `/transactions`
Listar transações.

**Query Params:**
- `account_id`: filtrar por conta
- `category_id`: filtrar por categoria
- `data_inicio`: YYYY-MM-DD
- `data_fim`: YYYY-MM-DD
- `tipo`: receita | despesa
- `page`: número da página (default: 1)
- `limit`: itens por página (default: 20)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "tipo": "despesa",
      "descricao": "Supermercado",
      "valor": 150.50,
      "data": "2024-03-20",
      "categoria": { "id": "uuid", "nome": "Alimentação" },
      "account_id": "uuid",
      "confirmada": true
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

---

### POST `/transactions`
Criar transação.

**Request:**
```json
{
  "tipo": "despesa",
  "descricao": "Restaurante",
  "valor": 85.50,
  "data": "2024-03-20",
  "category_id": "uuid",
  "account_id": "uuid",
  "card_id": "uuid",
  "tags": ["lazer", "alimentação"]
}
```

**Response:** `201 Created`

---

### PUT `/transactions/:id`
Atualizar transação.

**Request:**
```json
{
  "descricao": "Restaurante (atualizado)",
  "valor": 90.00,
  "categoria_id": "uuid"
}
```

**Response:** `200 OK`

---

### DELETE `/transactions/:id`
Deletar transação.

**Response:** `204 No Content`

---

## 🏷️ Categorias

### GET `/categories`
Listar categorias.

**Query Params:**
- `tipo`: receita | despesa

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "nome": "Alimentação",
      "tipo": "despesa",
      "icone": "🍔",
      "cor": "#FF5733",
      "customizada": false
    }
  ]
}
```

---

### POST `/categories`
Criar categoria customizada.

**Request:**
```json
{
  "nome": "Minha Categoria",
  "tipo": "despesa",
  "icone": "🎉",
  "cor": "#FF5733"
}
```

**Response:** `201 Created`

---

## 📊 Orçamentos

### GET `/budgets`
Listar orçamentos.

**Query Params:**
- `mes`: 1-12
- `ano`: 2024

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "category_id": "uuid",
      "categoria_nome": "Alimentação",
      "limite_mensal": 500.00,
      "gasto_atual": 350.25,
      "percentual_utilizado": 70,
      "mes": 3,
      "ano": 2024
    }
  ]
}
```

---

### POST `/budgets`
Criar orçamento.

**Request:**
```json
{
  "category_id": "uuid",
  "limite_mensal": 600.00,
  "mes": 3,
  "ano": 2024
}
```

**Response:** `201 Created`

---

## 🎯 Metas

### GET `/goals`
Listar metas.

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "nome": "Economizar para viagem",
      "valor_alvo": 3000.00,
      "valor_atual": 1500.00,
      "percentual_progresso": 50,
      "data_inicio": "2024-01-01",
      "data_fim": "2024-06-30",
      "status": "ativa"
    }
  ]
}
```

---

### POST `/goals`
Criar meta.

**Request:**
```json
{
  "nome": "Economizar para viagem",
  "valor_alvo": 3000.00,
  "categoria_id": "uuid",
  "data_inicio": "2024-01-01",
  "data_fim": "2024-06-30",
  "prioridade": "alta"
}
```

**Response:** `201 Created`

---

### PATCH `/goals/:id/update-progress`
Atualizar progresso de meta.

**Request:**
```json
{
  "valor_adicionado": 250.00
}
```

**Response:** `200 OK`

---

## 🔔 Alertas

### GET `/alerts`
Listar alertas.

**Query Params:**
- `lido`: true | false
- `tipo`: estouro_orcamento | risco_meta | etc

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "tipo": "estouro_orcamento",
      "mensagem": "Você estourou o orçamento de Alimentação",
      "severidade": "warning",
      "lido": false,
      "data_criacao": "2024-03-20T10:30:00Z"
    }
  ],
  "nao_lidos": 3
}
```

---

### PATCH `/alerts/:id/mark-as-read`
Marcar alerta como lido.

**Response:** `200 OK`

---

## 📈 Dashboard

### GET `/dashboard/summary`
Resumo financeiro.

**Response:** `200 OK`
```json
{
  "saldo_consolidado": 15000.00,
  "total_entradas_mes": 5000.00,
  "total_saidas_mes": 2500.00,
  "resultado_mes": 2500.00,
  "alertas_nao_lidos": 3
}
```

---

### GET `/dashboard/chart-categories`
Dados para gráfico de categorias.

**Response:** `200 OK`
```json
{
  "data": [
    {
      "categoria": "Alimentação",
      "valor": 350.50,
      "percentual": 28
    },
    {
      "categoria": "Transporte",
      "valor": 200.00,
      "percentual": 16
    }
  ],
  "total": 1250.50
}
```

---

### GET `/dashboard/chart-evolution`
Evolução mensal de receitas e despesas.

**Query Params:**
- `meses`: número de meses (default: 6)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "mes": "Janeiro",
      "receitas": 5000.00,
      "despesas": 2500.00,
      "saldo": 2500.00
    },
    {
      "mes": "Fevereiro",
      "receitas": 5000.00,
      "despesas": 2800.00,
      "saldo": 2200.00
    }
  ]
}
```

---

### GET `/dashboard/projection`
Projeção de saldo para o fim do mês.

**Response:** `200 OK`
```json
{
  "saldo_atual": 8500.00,
  "saldo_projetado_fim_mes": 10500.00,
  "diferenca": 2000.00,
  "dias_restantes": 10
}
```

---

## Error Responses

Todos os erros seguem o padrão:

```json
{
  "statusCode": 400,
  "message": "Mensagem de erro",
  "error": "BadRequest"
}
```

### Status Codes Comuns
- `200` OK
- `201` Created
- `204` No Content
- `400` Bad Request
- `401` Unauthorized
- `403` Forbidden
- `404` Not Found
- `409` Conflict
- `422` Unprocessable Entity
- `500` Internal Server Error

