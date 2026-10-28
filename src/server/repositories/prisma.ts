import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@/prisma/generated/client';
import { pinVerifyFullSslMode } from '@/server/lib/pg-connection-string';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const datasourceUrl = process.env.DATABASE_URL;

if (!datasourceUrl) {
	throw new Error('DATABASE_URL is not set');
}

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		adapter: new PrismaPg(
			new Pool({ connectionString: pinVerifyFullSslMode(datasourceUrl) }),
		),
	});

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}
