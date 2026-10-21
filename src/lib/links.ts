// Single source of truth for in-app URLs. Never hand-write '/merchants/' + id in a page - use these helpers.
// Route params are row ids (see docs/DATA_MODEL.md "Cross-page links").

export const ROUTES = {
  overview: '/',
  merchants: '/merchants',
  onboarding: '/onboarding',
  support: '/support',
  subscriptions: '/subscriptions',
  contacts: '/contacts',
  churn: '/churn',
  faq: '/faq',
  promotions: '/promotions',
  settings: '/settings',
  help: '/help',
} as const

/** Merchant profile: merchants.id */
export const merchantPath = (id: string) => `/merchants/${id}`
/** Merchant activity history: merchants.id */
export const activityPath = (merchantId: string) => `/merchants/${merchantId}/activity`
/** Onboarding detail of a merchant: merchants.id */
export const onboardingPath = (merchantId: string) => `/onboarding/${merchantId}`
/** Support ticket detail: support_tickets.id */
export const supportPath = (ticketId: string) => `/support/${ticketId}`
/** Current subscription of a merchant: merchants.id */
export const subscriptionPath = (merchantId: string) => `/subscriptions/${merchantId}`
/** Invoice of a merchant's subscription; optional invoice number (HD-2025-88392) -> ?no= */
export const invoicePath = (merchantId: string, no?: string | null) =>
  `/subscriptions/${merchantId}/invoice${no ? `?no=${encodeURIComponent(no)}` : ''}`
/** Contact history, optionally pre-filtered by search text (merchant code / name) -> ?q= */
export const contactsPath = (q?: string | null) => (q ? `/contacts?q=${encodeURIComponent(q)}` : '/contacts')
/** Churn board (no detail route) */
export const churnPath = () => '/churn'
/** Promotions page (no detail route) */
export const promotionsPath = () => '/promotions'

/** "Create" shortcuts: the list page opens its create modal on mount (see useNewParam). */
export const newPath = (section: 'merchants' | 'support' | 'contacts' | 'subscriptions' | 'onboarding' | 'promotions' | 'faq') =>
  `/${section}?new=1`
