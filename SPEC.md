# Giaodoan Merchant CRM — SPEC

## Goal
Turn the 14 static Stitch screens in `design/*/code.html` into a working web app backed by a public Supabase database, deployed free on Cloudflare Pages (`*.pages.dev`).

## Stack
- Vite + React + TypeScript, Tailwind CSS v3 (port the `tailwind.config` from the Stitch HTML verbatim: colors, spacing, fontFamily, fontSize, borderRadius), Google Fonts (Be Vietnam Pro, Plus Jakarta Sans, Material Symbols Outlined).
- `react-router-dom` (BrowserRouter; Cloudflare Pages serves SPA fallback automatically when there is no `404.html`).
- `@supabase/supabase-js`, configured from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (`.env.local`, git-ignored; `.env.example` committed).
- pnpm.

## Routes (one per design screen; UI must match the design closely)
| Route | Design folder |
|---|---|
| `/merchants` | h_s_merchant_qu_n_l_i_t_c_giaodoan_dropdown_tr_ng_th_i |
| `/merchants/:id` | chi_ti_t_h_s_merchant_whisper_coffee_lounge |
| `/merchants/:id/activity` | l_ch_s_ho_t_ng_merchant_whisper_coffee_lounge |
| `/onboarding` | ti_n_onboarding_qu_n_l_i_t_c_giaodoan |
| `/onboarding/:merchantId` | chi_ti_t_ti_n_onboarding_whisper_coffee_lounge |
| `/support` | y_u_c_u_h_tr_qu_n_l_i_t_c_giaodoan |
| `/support/:id` | chi_ti_t_y_u_c_u_h_tr_tk_8841_qu_n_l_i_t_c_giaodoan |
| `/subscriptions` | g_i_d_ch_v_gia_h_n_d_ch_v_giaodoan |
| `/subscriptions/:merchantId` | chi_ti_t_g_i_d_ch_v_whisper_coffee_lounge |
| `/subscriptions/:merchantId/invoice` | h_a_n_gia_h_n_d_ch_v_whisper_coffee_lounge_thu_g_n_1_trang |
| `/contacts` | l_ch_s_li_n_h_qu_n_l_i_t_c_giaodoan |
| `/churn` | nguy_c_r_i_b_qu_n_l_i_t_c_giaodoan |
| `/faq` | faq_qu_n_l_i_t_c_giaodoan |
| `/promotions` | ctkm_qu_n_l_i_t_c_giaodoan |
`/` redirects to `/merchants`. Sidebar `cai-dat`/`tro-giup` items may stay inert.

## Behaviour ("works")
- Shared layout: sidebar with active state, header with breadcrumb.
- Every list reads from Supabase; KPI cards are computed from data, not hard-coded.
- Search box and filter dropdowns/tabs on each list filter the data; pagination if the design has it.
- Row/name click navigates to the matching detail route.
- Status dropdowns (e.g. merchant status, ticket status) update the row in Supabase.
- Primary "Thêm …" / "+ Tạo …" buttons open a modal form that inserts a row; detail pages allow editing key fields; FAQ/promotions support edit + delete.
- "Xuất dữ liệu Excel" exports the current filtered list as CSV (UTF-8 BOM so Excel shows Vietnamese).
- Invoice page has a working Print button (`window.print()`).
- Loading and error states on every data fetch.

## Data
- `supabase/migrations/0001_init.sql`: tables derived from the screens (at least merchants, onboarding steps, support tickets + messages, subscriptions/packages + invoices, contact logs, churn risk, activity log, faqs, promotions), FKs to `merchants`, RLS enabled with **public anon select/insert/update/delete** policies (the user asked for a public database).
- `supabase/seed.sql`: realistic Vietnamese seed data taken from the design content (Whisper Coffee Lounge etc.), enough rows to make every screen look like the design.

## Out of scope
Authentication, roles, real email/SMS, file uploads, i18n switcher (VIE badge is static), mobile layout below 1024px.

## End-to-end check
1. `pnpm install && pnpm build` → exit 0, no TS errors.
2. `node scripts/check-db.mjs` → queries every table via the anon key and prints row counts; all > 0.
3. `pnpm preview`, open each of the 14 routes in a browser: data renders, no console errors; create a merchant, change its status, reload → change persists.
4. Same click-through on the deployed `https://<name>.pages.dev` URL.
