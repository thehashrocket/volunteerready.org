import { PrismaClient } from '@/prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const datasourceUrl = process.env.DATABASE_URL;

if (!datasourceUrl) {
	throw new Error('DATABASE_URL is not set');
}

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		adapter: new PrismaPg(new Pool({ connectionString: datasourceUrl })),
	});

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}
