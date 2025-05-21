import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file in the backend directory
// Using process.cwd() assuming the script is run from the 'backend' directory root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Define a more specific type for DB_TYPE if possible, or use a common subset
type DatabaseType = 'postgres';

export const dataSourceOptions: DataSourceOptions = {
  type: (process.env.DB_TYPE as DatabaseType) || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'prompt_compression_dev',
  synchronize: false, // Never use TRUE in production! Always use migrations.
  logging:
    process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'], // Log queries and errors in dev
  // Using path.join and process.cwd() for robustness
  entities: [path.join(process.cwd(), 'src', '**', '*.entity{.ts,.js}')],
  migrations: [path.join(process.cwd(), 'src', 'migrations', '*{.ts,.js}')],
  migrationsTableName: 'typeorm_migrations', // Table to store migration history
  ssl:
    process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
