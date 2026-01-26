import { z } from 'zod';
import { t } from '../init';
import { publicStatusService } from '@/server/repositories/publicStatusService';

export const statusRouter = t.router({
	requestLink: t.procedure
		.input(z.object({ email: z.string().email() }))
		.mutation(async ({ ctx, input }) => {
			const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
			if (!baseUrl) throw new Error('NEXT_PUBLIC_APP_URL is not set');
			const svc = publicStatusService(ctx.prisma);
			return svc.requestLink(input.email, baseUrl);
		}),

	getByToken: t.procedure
		.input(z.object({ token: z.string().min(10) }))
		.query(async ({ ctx, input }) => {
			const svc = publicStatusService(ctx.prisma);
			return svc.getByToken(input.token);
		}),
});
