import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    // Consulta trivial só para confirmar que a conexão com o banco está viva —
    // sem isso o healthcheck passaria mesmo com o Postgres fora do ar.
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
