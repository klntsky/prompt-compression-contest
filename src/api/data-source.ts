import 'reflect-metadata';
import { DatabaseType, DataSource, type DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
// Define options directly in the DataSource constructor
const AppDataSource = new DataSource({
  type: (process.env.DB_TYPE as DatabaseType) || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'test',
  password: process.env.DB_PASSWORD || 'test',
  database: process.env.DB_DATABASE || 'prompt_compression_dev',
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  entities: [path.join(__dirname, 'entities', '*{.ts,.js}')],
  migrations: [path.join(__dirname, 'migrations', '*{.ts,.js}')],
  migrationsTableName: 'typeorm_migrations',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  logging:
    process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
} as DataSourceOptions);

export default AppDataSource;
