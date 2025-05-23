import "reflect-metadata";
import { DataSource, DataSourceOptions } from "typeorm";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env file in the backend directory
// Using process.cwd() assuming the script is run from the 'backend' directory root
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

type DatabaseType = "postgres";

export const dataSourceOptions: DataSourceOptions = {
  type: (process.env.DB_TYPE as DatabaseType) || "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_DATABASE || "prompt_compression_dev",
  synchronize: process.env.DB_SYNCHRONIZE === "true",
  entities: [path.join(process.cwd(), "src", "entity", "*{.ts,.js}")],
  migrations: [path.join(process.cwd(), "src", "migration", "*{.ts,.js}")],
  migrationsTableName: "typeorm_migrations",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  logging: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"]
};

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
