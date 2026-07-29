/**
 * Resolve as opções de conexão do Postgres a partir do ambiente.
 *
 * Aceita tanto DATABASE_URL (formato que Railway, Neon e afins entregam pronto)
 * quanto as variáveis avulsas usadas no desenvolvimento local. Manter os dois
 * caminhos aqui evita que data-source.ts (CLI de migrations) e
 * database.config.ts (runtime da app) divirjam com o tempo.
 */

export interface DatabaseConnectionOptions {
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  ssl: { rejectUnauthorized: boolean } | false;
}

type EnvReader = (key: string) => string | undefined;

export function resolveDatabaseConnection(
  getEnv: EnvReader,
): DatabaseConnectionOptions {
  const url = getEnv('DATABASE_URL');

  // Postgres gerenciado exposto publicamente costuma exigir SSL, mas com
  // certificado que não encadeia numa CA pública — daí o rejectUnauthorized
  // false. Na rede interna do Railway não há SSL, por isso o padrão é off.
  const sslEnabled =
    getEnv('DATABASE_SSL') === 'true' || Boolean(url?.includes('sslmode=require'));
  const ssl = sslEnabled ? { rejectUnauthorized: false } : false;

  if (url) {
    return { url, ssl };
  }

  return {
    host: getEnv('DATABASE_HOST') || 'localhost',
    port: Number(getEnv('DATABASE_PORT')) || 5432,
    username: getEnv('DATABASE_USER') || 'postgres',
    password: getEnv('DATABASE_PASSWORD') || 'postgres',
    database: getEnv('DATABASE_NAME') || 'finance_os_db',
    ssl,
  };
}
