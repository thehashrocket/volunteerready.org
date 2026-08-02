import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { reportTrpcError } from '@/server/trpc/error-reporting';
import { createTRPCContext } from '@/server/trpc/init';
import { appRouter } from '@/server/trpc/root';

const handler = (req: Request) =>
	fetchRequestHandler({
		endpoint: '/api/trpc',
		req,
		router: appRouter,
		createContext: (opts) => createTRPCContext(opts),
		// Runs with the RAW error, before `errorFormatter` redacts it for the
		// wire. See `error-reporting.ts` for why that ordering is the point.
		onError: reportTrpcError,
	});

export { handler as GET, handler as POST };
