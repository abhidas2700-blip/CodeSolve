import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use the exact database URL with SSL parameters
let connectionString = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_jbypqi8SLvJ4@ep-billowing-water-a1dbc0af-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

// Clean up malformed DATABASE_URL that might have psql wrapper
if (connectionString.startsWith("psql '") && connectionString.endsWith("'")) {
  connectionString = connectionString.slice(6, -1); // Remove "psql '" and "'"
  console.log("Cleaned malformed DATABASE_URL");
}

export const pool = new Pool({ 
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

export const db = drizzle(pool, { schema });
