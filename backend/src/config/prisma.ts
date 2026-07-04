import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Create a connection pool using the DATABASE_URL environment variable (stripping any quotes)
const databaseUrl = process.env.DATABASE_URL?.replace(/^"|"$/g, '');
const pool = new pg.Pool({
  connectionString: databaseUrl,
});

const adapter = new PrismaPg(pool);

// Global PrismaClient instance shared across the application
const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export default prisma;
export * from '../generated/prisma/index.js';
