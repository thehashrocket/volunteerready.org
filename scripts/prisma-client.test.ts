import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrismaPg = vi.fn();
const mockPool = vi.fn();
const mockPrismaClient = vi.fn();

vi.mock('@prisma/adapter-pg', () => ({ PrismaPg: mockPrismaPg }));
vi.mock('pg', () => ({ Pool: mockPool }));
vi.mock('../src/prisma/generated/client', () => ({
	PrismaClient: mockPrismaClient,
}));

describe('scripts/prisma-client', () => {
	const originalEnv = process.env.DATABASE_URL;
	const originalExit = process.exit;
	const originalError = console.error;

	beforeEach(() => {
		vi.resetModules();
		vi.resetAllMocks();
		process.exit = vi.fn() as never;
		console.error = vi.fn();
	});

	afterEach(() => {
		if (originalEnv === undefined) {
			delete process.env.DATABASE_URL;
		} else {
			process.env.DATABASE_URL = originalEnv;
		}
		process.exit = originalExit;
		console.error = originalError;
		vi.resetModules();
	});

	it('exits with code 1 when DATABASE_URL is not set', async () => {
		delete process.env.DATABASE_URL;
		// The module throws 'unreachable' after process.exit so Pool is never constructed
		await expect(import('./prisma-client')).rejects.toThrow('unreachable');
		expect(console.error).toHaveBeenCalledWith(
			'Error: DATABASE_URL is not set',
		);
		expect(process.exit).toHaveBeenCalledWith(1);
	});

	it('constructs PrismaClient with PrismaPg adapter when DATABASE_URL is set', async () => {
		process.env.DATABASE_URL = 'postgresql://user:pass@localhost/testdb';
		const poolInstance = {};
		const adapterInstance = {};
		// Arrow functions can't be constructors — must use function keyword for `new`
		mockPool.mockImplementation(function () {
			return poolInstance;
		});
		mockPrismaPg.mockImplementation(function () {
			return adapterInstance;
		});
		mockPrismaClient.mockImplementation(function () {
			return {};
		});

		await import('./prisma-client');

		expect(mockPool).toHaveBeenCalledWith({
			connectionString: 'postgresql://user:pass@localhost/testdb',
		});
		expect(mockPrismaPg).toHaveBeenCalledWith(poolInstance);
		expect(mockPrismaClient).toHaveBeenCalledWith({
			adapter: adapterInstance,
		});
	});

	it('exports a prisma instance when DATABASE_URL is set', async () => {
		process.env.DATABASE_URL = 'postgresql://user:pass@localhost/testdb';
		const clientInstance = { query: vi.fn() };
		mockPool.mockImplementation(function () {
			return {};
		});
		mockPrismaPg.mockImplementation(function () {
			return {};
		});
		mockPrismaClient.mockImplementation(function () {
			return clientInstance;
		});

		const mod = await import('./prisma-client');

		expect(mod.prisma).toBe(clientInstance);
	});
});
