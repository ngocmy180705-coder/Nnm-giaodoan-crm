// Usage: node scripts/check-db.mjs   (reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.local or the environment)
// Counts rows in every table through the anon key; exits 1 if any table errors or is empty.
import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envFile = new URL('../.env.local', import.meta.url)
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (create .env.local from .env.example)')
  process.exit(1)
}

const TABLES = [
  'staff', 'merchants', 'merchant_contacts', 'service_plans', 'subscriptions', 'invoices',
  'onboardings', 'onboarding_steps', 'onboarding_tasks',
  'support_tickets', 'ticket_attachments', 'ticket_messages', 'reply_templates',
  'contact_logs', 'churn_risks', 'activity_logs', 'faqs',
  'promotions', 'promotion_merchants', 'promotion_budgets',
]

const supabase = createClient(url, key)
let failed = false

for (const table of TABLES) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) {
    failed = true
    console.log(`${table.padEnd(22)} ERROR  ${error.message}`)
  } else {
    if (!count) failed = true
    console.log(`${table.padEnd(22)} ${String(count).padStart(5)}${count ? '' : '  <-- EMPTY'}`)
  }
}

console.log(failed ? '\nFAILED: at least one table is empty or errored' : '\nOK: all tables have rows')
process.exit(failed ? 1 : 0)
