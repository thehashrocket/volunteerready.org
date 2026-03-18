import { Award, Fingerprint, GraduationCap, Shield, Users } from 'lucide-react';
import { CREDENTIAL_LABELS } from '@/server/domain/volunteer-profile';

export const CREDENTIAL_META: Record<
	string,
	{ label: string; icon: typeof Shield }
> = {
	BACKGROUND_CHECK: { label: CREDENTIAL_LABELS.BACKGROUND_CHECK, icon: Shield },
	TRAINING_COMPLETE: {
		label: CREDENTIAL_LABELS.TRAINING_COMPLETE,
		icon: GraduationCap,
	},
	ID_VERIFIED: { label: CREDENTIAL_LABELS.ID_VERIFIED, icon: Fingerprint },
	REFERENCE_CHECK: { label: CREDENTIAL_LABELS.REFERENCE_CHECK, icon: Users },
	ORIENTATION_COMPLETE: {
		label: CREDENTIAL_LABELS.ORIENTATION_COMPLETE,
		icon: GraduationCap,
	},
	TENURE_1YR: { label: CREDENTIAL_LABELS.TENURE_1YR, icon: Award },
	TENURE_3YR: { label: CREDENTIAL_LABELS.TENURE_3YR, icon: Award },
	TENURE_5YR: { label: CREDENTIAL_LABELS.TENURE_5YR, icon: Award },
};

export function getCredentialMeta(type: string) {
	return (
		CREDENTIAL_META[type] ?? { label: type.replace(/_/g, ' '), icon: Shield }
	);
}
