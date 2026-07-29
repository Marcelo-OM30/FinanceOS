import 'reflect-metadata';
import { DataSource, IsNull } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../../modules/users/entities/user.entity';
import { Account } from '../../modules/accounts/entities/account.entity';
import { Card } from '../../modules/accounts/entities/card.entity';
import { Category } from '../../modules/categories/entities/category.entity';
import { Transaction } from '../../modules/transactions/entities/transaction.entity';
import { Budget } from '../../modules/budgets/entities/budget.entity';
import { Goal } from '../../modules/goals/entities/goal.entity';
import { GoalProgress } from '../../modules/goals/entities/goal-progress.entity';
import { Alert } from '../../modules/dashboard/entities/alert.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { resolveDatabaseConnection } from '../../config/database-connection';

config();

const SYSTEM_CATEGORIES: Array<{
  nome: string;
  tipo: 'receita' | 'despesa';
  icone: string;
  cor: string;
}> = [
  { nome: 'Alimentação', tipo: 'despesa', icone: '🍽️', cor: '#f97316' },
  { nome: 'Transporte', tipo: 'despesa', icone: '🚗', cor: '#3b82f6' },
  { nome: 'Saúde', tipo: 'despesa', icone: '⚕️', cor: '#ef4444' },
  { nome: 'Educação', tipo: 'despesa', icone: '📚', cor: '#8b5cf6' },
  { nome: 'Moradia', tipo: 'despesa', icone: '🏠', cor: '#0ea5e9' },
  { nome: 'Lazer', tipo: 'despesa', icone: '🎮', cor: '#ec4899' },
  { nome: 'Utilidades', tipo: 'despesa', icone: '💡', cor: '#eab308' },
  { nome: 'Pessoal', tipo: 'despesa', icone: '🧴', cor: '#14b8a6' },
  { nome: 'Investimentos', tipo: 'despesa', icone: '📈', cor: '#22c55e' },
  { nome: 'Outras Despesas', tipo: 'despesa', icone: '📦', cor: '#64748b' },
  { nome: 'Salário', tipo: 'receita', icone: '💰', cor: '#22c55e' },
  { nome: 'Freelance/Bicos', tipo: 'receita', icone: '💼', cor: '#0ea5e9' },
  { nome: 'Investimentos', tipo: 'receita', icone: '📊', cor: '#16a34a' },
  { nome: 'Outras Receitas', tipo: 'receita', icone: '💵', cor: '#84cc16' },
  { nome: 'Transferências', tipo: 'receita', icone: '🔄', cor: '#6366f1' },
];

async function run() {
  const dataSource = new DataSource({
    type: 'postgres',
    ...resolveDatabaseConnection((key) => process.env[key]),
    entities: [
      User,
      Account,
      Card,
      Category,
      Transaction,
      Budget,
      Goal,
      GoalProgress,
      Alert,
      AuditLog,
    ],
  });

  await dataSource.initialize();
  const repo = dataSource.getRepository(Category);

  for (const seed of SYSTEM_CATEGORIES) {
    const existing = await repo.findOne({
      where: { nome: seed.nome, tipo: seed.tipo, userId: IsNull() },
    });
    if (existing) {
      console.log(`- já existe: ${seed.nome} (${seed.tipo})`);
      continue;
    }
    const category = repo.create({
      nome: seed.nome,
      tipo: seed.tipo,
      icone: seed.icone,
      cor: seed.cor,
      customizada: false,
    });
    await repo.save(category);
    console.log(`+ criada: ${seed.nome} (${seed.tipo})`);
  }

  await dataSource.destroy();
  console.log('Seed de categorias concluído.');
}

run().catch((err) => {
  console.error('Erro ao rodar seed:', err);
  process.exit(1);
});
