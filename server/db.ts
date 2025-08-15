import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Clean up malformed DATABASE_URL that might have psql wrapper
let connectionString = process.env.DATABASE_URL;
if (connectionString.startsWith("psql '") && connectionString.endsWith("'")) {
  connectionString = connectionString.slice(6, -1); // Remove "psql '" and "'"
  console.log("Cleaned malformed DATABASE_URL");
}

export const pool = new Pool({ 
  connectionString: connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export const db = drizzle(pool, { schema });
