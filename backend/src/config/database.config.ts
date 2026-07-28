import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Account } from '../modules/accounts/entities/account.entity';
import { Card } from '../modules/accounts/entities/card.entity';
import { Category } from '../modules/categories/entities/category.entity';
import { Transaction } from '../modules/transactions/entities/transaction.entity';
import { Budget } from '../modules/budgets/entities/budget.entity';
import { Goal } from '../modules/goals/entities/goal.entity';
import { GoalProgress } from '../modules/goals/entities/goal-progress.entity';
import { Alert } from '../modules/dashboard/entities/alert.entity';
import { AuditLog } from '../database/entities/audit-log.entity';

export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('DATABASE_HOST', 'localhost'),
  port: configService.get('DATABASE_PORT', 5432),
  username: configService.get('DATABASE_USER', 'postgres'),
  password: configService.get('DATABASE_PASSWORD', 'postgres'),
  database: configService.get('DATABASE_NAME', 'finance_os_db'),
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
  synchronize: configService.get('NODE_ENV') === 'development',
  logging: configService.get('NODE_ENV') === 'development',
  migrations: [join(__dirname, '../database/migrations', __filename.endsWith('.ts') ? '*.ts' : '*.js')],
  migrationsTableName: 'typeorm_migrations',
});
