import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../src/prisma/generated/client';

const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
	console.error('Error: DATABASE_URL is not set');
	process.exit(1);
	throw new Error('unreachable');
}

export const prisma = new PrismaClient({
	adapter: new PrismaPg(new Pool({ connectionString: datasourceUrl })),
});
