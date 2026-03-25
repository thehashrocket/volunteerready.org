import {
	Bug,
	Frown,
	Lightbulb,
	type LucideIcon,
	Meh,
	SmilePlus,
} from 'lucide-react';
import type { FeedbackMood } from '@/prisma/generated/client';

export interface MoodUIConfig {
	icon: LucideIcon;
	label: string;
	confirmation: string;
	confirmationIcon: 'CheckCircle' | 'Heart' | 'Sparkles' | 'Check';
}

export const MOOD_UI_CONFIG: Record<FeedbackMood, MoodUIConfig> = {
	HAPPY: {
		icon: SmilePlus,
		label: 'Great',
		confirmation: 'That made our day — thank you!',
		confirmationIcon: 'Heart',
	},
	NEUTRAL: {
		icon: Meh,
		label: 'Okay',
		confirmation: 'Thanks for sharing.',
		confirmationIcon: 'Check',
	},
	FRUSTRATED: {
		icon: Frown,
		label: 'Frustrated',
		confirmation: 'We hear you. Our team will look into this.',
		confirmationIcon: 'CheckCircle',
	},
	BUG: {
		icon: Bug,
		label: 'Bug',
		confirmation: 'We hear you. Our team will look into this.',
		confirmationIcon: 'CheckCircle',
	},
	IDEA: {
		icon: Lightbulb,
		label: 'Idea',
		confirmation: "Great idea — we'll consider it.",
		confirmationIcon: 'Sparkles',
	},
};
