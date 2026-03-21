import 'next-auth';

declare module 'next-auth' {
	interface Session {
		sessionToken?: string | null;
		currentOrgId?: string | null;
		orgId?: string | null;
		role?: string | null;
		currentCompanyId?: string | null;
		companyId?: string | null;
		companyRole?: string | null;
		user: {
			id: string;
			name?: string | null;
			email?: string | null;
			image?: string | null;
		};
	}
}
