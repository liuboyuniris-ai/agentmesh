/**
 * Stripe and entitlements are not integrated yet.
 * `AgentUsageLedger` records usage for future billing / quotas.
 */
export function isStripeBillingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
