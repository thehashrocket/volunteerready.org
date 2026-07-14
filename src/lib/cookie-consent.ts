/**
 * Cookie-consent storage constants — kept in lib (framework-free) so both the
 * client banner and Node-side tooling (the e2e capture pipeline pre-consents
 * to keep the banner out of marketing screenshots) share one source of truth.
 */
export const COOKIE_CONSENT_STORAGE_KEY = 'vr-cookie-consent';

export interface CookieConsentPreferences {
	essential: true;
	analytics: boolean;
}
