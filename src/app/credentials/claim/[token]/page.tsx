import ClaimClient from './ClaimClient';

type Props = {
	params: Promise<{ token: string }>;
};

export default async function ClaimPage({ params }: Props) {
	const { token } = await params;
	return <ClaimClient token={token} />;
}
