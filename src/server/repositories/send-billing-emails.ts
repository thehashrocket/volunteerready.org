import type { PlanTier } from '@/prisma/generated/client';
import { sendEmail } from '@/server/lib/email';

const TIER_DISPLAY: Record<PlanTier, string> = {
	FREE: 'Free',
	STARTER: 'Starter',
	PRO: 'Pro',
};

export async function sendPlanUpgradeEmail(opts: {
	to: string;
	orgName: string;
	tier: PlanTier;
}): Promise<void> {
	const tierDisplay = TIER_DISPLAY[opts.tier] ?? opts.tier;

	await sendEmail(
		opts.to,
		`Welcome to VolunteerReady ${tierDisplay}!`,
		`
        <p>Hi there,</p>
        <p>
          Great news! <strong>${opts.orgName}</strong> has been upgraded to the
          <strong>${tierDisplay}</strong> plan on VolunteerReady.
        </p>
        <p>
          You now have access to all ${tierDisplay}-tier features. Log in to your dashboard
          to start using them right away.
        </p>
        <p>
          If you have questions about your subscription, visit your
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.volunteerready.com'}/app/billing" style="color: #1B3C2A;">billing settings</a>.
        </p>
        <p>Thank you for supporting your volunteers!</p>
    `,
	);
}

export async function sendPaymentFailedEmail(opts: {
	to: string;
	orgName: string;
}): Promise<void> {
	await sendEmail(
		opts.to,
		`Action required: payment failed for ${opts.orgName}`,
		`
        <p>Hi there,</p>
        <p>
          We were unable to process the latest payment for <strong>${opts.orgName}</strong>'s
          VolunteerReady subscription.
        </p>
        <p>
          Please update your payment method to avoid any interruption to your service.
        </p>
        <p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.volunteerready.com'}/app/billing"
             style="display: inline-block; padding: 10px 20px; background: #1B3C2A; color: white; text-decoration: none; border-radius: 6px;">
            Update payment method
          </a>
        </p>
        <p style="color: #6b7280; font-size: 0.875rem;">
          If you believe this is an error, please contact your payment provider or reach out to us.
        </p>
    `,
	);
}

export async function sendCancellationEmail(opts: {
	to: string;
	orgName: string;
	previousTier: PlanTier;
}): Promise<void> {
	const tierDisplay = TIER_DISPLAY[opts.previousTier] ?? opts.previousTier;

	await sendEmail(
		opts.to,
		'Your VolunteerReady subscription has been cancelled',
		`
        <p>Hi there,</p>
        <p>
          The <strong>${tierDisplay}</strong> subscription for <strong>${opts.orgName}</strong>
          has been cancelled. Your account has been moved to the Free plan.
        </p>
        <p>
          You can continue using VolunteerReady with Free-tier limits. If you'd like to
          resubscribe, you can do so anytime from your billing settings.
        </p>
        <p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.volunteerready.com'}/app/billing"
             style="display: inline-block; padding: 10px 20px; background: #1B3C2A; color: white; text-decoration: none; border-radius: 6px;">
            Resubscribe
          </a>
        </p>
        <p>We hope to see you back soon!</p>
    `,
	);
}
