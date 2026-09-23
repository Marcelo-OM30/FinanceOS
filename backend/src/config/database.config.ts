import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
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
import { AuditLog } from '../database/entities/audit-log.entity';
import { resolveDatabaseConnection } from './database-connection';

export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  ...resolveDatabaseConnection((key) => configService.get<string>(key)),
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
  synchronize: configService.get('NODE_ENV') === 'development',
  logging: configService.get('NODE_ENV') === 'development',
  migrations: [join(__dirname, '../database/migrations', __filename.endsWith('.ts') ? '*.ts' : '*.js')],
  migrationsTableName: 'typeorm_migrations',
});
