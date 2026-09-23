import 'reflect-metadata';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../modules/users/entities/user.entity';
import { Account } from '../modules/accounts/entities/account.entity';
import { Card } from '../modules/accounts/entities/card.entity';
import { Category } from '../modules/categories/entities/category.entity';
import { Transaction } from '../modules/transactions/entities/transaction.entity';
import { InstallmentPurchase } from '../modules/installments/entities/installment-purchase.entity';
import { Budget } from '../modules/budgets/entities/budget.entity';
import { Goal } from '../modules/goals/entities/goal.entity';
import { GoalProgress } from '../modules/goals/entities/goal-progress.entity';
import { Alert } from '../modules/dashboard/entities/alert.entity';
import { AuditLog } from './entities/audit-log.entity';
import { resolveDatabaseConnection } from '../config/database-connection';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...resolveDatabaseConnection((key) => process.env[key]),
  schema: process.env.DATABASE_SCHEMA || undefined,
  entities: [
    User,
    Account,
    Card,
    Category,
    Transaction,
    InstallmentPurchase,
    Budget,
    Goal,
    GoalProgress,
    Alert,
    AuditLog,
  ],
  // __filename ends in .ts when run via ts-node (local CLI) and .js once
  // compiled to dist/ (production) — point at the matching migration files
  // in either case instead of hardcoding a src-relative .ts glob.
  migrations: [join(__dirname, 'migrations', __filename.endsWith('.ts') ? '*.ts' : '*.js')],
  migrationsTableName: 'typeorm_migrations',
});
