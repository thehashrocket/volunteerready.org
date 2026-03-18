/**
 * Integration test setup — connects to the real test database.
 * Requires DATABASE_URL to point to a test database instance.
 * The local dev Postgres (Docker: volunteer-match-postgres) is used.
 */
import { afterAll } from 'vitest';
import { prisma } from '@/server/repositories/prisma';

afterAll(async () => {
	await prisma.$disconnect();
});
