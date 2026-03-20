import { drizzle } from 'drizzle-orm/node-postgres';
import { loadEnvConfig } from '@next/env'
 
const projectDir = process.cwd()
loadEnvConfig(projectDir)

export const db = drizzle(process.env.DATABASE_URL!);
