import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables for CLI usage
dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'kyc_adapter',
  ssl: process.env.DB_SSL === 'true',

  // Entity locations
  entities: [__dirname + '/entities/*.entity{.ts,.js}'],

  // Migration settings
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTableName: 'typeorm_migrations',

  // CLI settings
  synchronize: false, // Never use synchronize in production
  logging: process.env.DB_LOGGING === 'true',
});