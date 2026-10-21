# UI guide (conventions every page must follow)

The shell (`src/components/Layout.tsx`) is responsive and owns the header, drawer, breadcrumb, toast. Pages own only their content. Design tokens come from `tailwind.config.js` (do not add raw hex colours except the existing StatusBadge ones).

## 1. Breakpoints (Tailwind defaults)
| Name | Width | Shell behaviour |
|---|---|---|
| (base) phone | < 640 | off-canvas sidebar drawer (hamburger), header = hamburger + page title + bell + avatar, page gutter 1rem |
| `sm` | >= 640 | gutter 1.5rem, modals become centered dialogs, toasts bottom-right |
| `md` | >= 768 | linked breadcrumb + language chip + user name in header; table switches from cards to table |
| `lg` | >= 1024 | fixed sidebar w-64; two-column detail layouts side by side |
| `xl` | >= 1280 | wide KPI grids, GMT+7 chip |

Rules: design mobile-first (base classes = phone, add `sm:`/`md:`/`lg:`). Never use fixed widths/min-widths on page containers (only inside a scrolling table wrapper). Every page must have `document.documentElement.scrollWidth <= innerWidth` at 390px. Page root: `className="flex flex-col gap-space-lg px-margin py-space-lg"` (`px-margin` is 1rem on phones, 1.5rem from `sm`, automatically).

## 2. Page header
Use `<PageHeader title subtitle eyebrow actions />` (`src/components/PageHeader.tsx`). Actions wrap and become an equal-width row on phones. Buttons use `btnPrimary` / `btnSecondary` from `Form.tsx` (centered content, wrap-safe).

## 3. Tables - ONE pattern
Wrap every `<table>` in `ResponsiveTable` (`src/components/ResponsiveTable.tsx`):
```tsx
<ResponsiveTable minWidth={880}
  cards={pageRows.map((r) => (
    <MobileCard key={r.id} title={<Link to={merchantPath(r.id)}>{r.name}</Link>} badge={<StatusBadge ...>} fields={[['Mã', r.code], ['Khu vực', r.region]]} actions={...} />
  ))}>
  <table className="w-full text-left">...</table>
</ResponsiveTable>
```
- Always pass `minWidth` (the width at which columns stop being readable, 640-1000).
- Lists with <= 5 meaningful columns, or rows that are primarily "an entity": pass `cards` (stacked cards below `md`, table from `md`).
- Dense/numeric tables (invoices, history, budgets): omit `cards`; the table scrolls horizontally inside its wrapper (never the page).
- Never `hidden`/`overflow-hidden` a table to make it fit. Row actions must stay reachable on phones (put them in `MobileCard actions`).
- Pagination: `<Pagination>` is already compact on phones ("Trang x/y"). Use `useSettings().settings.pageSize` (from `src/lib/settings.ts`) instead of a hard-coded page size. Compact density (`html[data-density=compact]`) is applied globally via CSS - do not re-implement.

## 4. Toolbars / filters
- Toolbar container: `flex flex-col gap-space-md md:flex-row md:items-center md:justify-between` (or `flex flex-wrap gap-space-sm`). Status pill rows: `flex gap-2 overflow-x-auto pb-1` with `whitespace-nowrap` pills (horizontal swipe), or `flex-wrap`.
- `<SearchInput>` is full-width on phones (`sm:w-96`), the ⌘K hint is hidden on phones and the shortcut really focuses it.
- Selects/dropdowns in a toolbar: `w-full sm:w-auto`. Filter panels that are collapsible must collapse on phones by default.
- Inputs: use `inputCls` (16px text on phones to avoid iOS zoom).

## 5. Detail pages
- Two-column layouts: `grid grid-cols-1 gap-space-lg lg:grid-cols-3` (main `lg:col-span-2`, side column below on phones). Never `flex` rows with fixed widths.
- Hero blocks: stack avatar/title/actions on phones (`flex-col sm:flex-row`), long titles `min-w-0 truncate`/`break-words`.
- Always provide a way back: call `useBreadcrumb([...])` (see 7) - on detail pages the list crumb links back to the list.

## 6. Modals, forms, KPI cards
- `<Modal>` = full-screen sheet on phones (scrollable body, footer pinned, footer buttons stretch), centered dialog from `sm`. Put actions in the `footer` prop, never inside the scrolling body.
- Forms: wrap fields in `<FormGrid>` (1 col phone, 2 cols from `sm`); full-width fields get `className="sm:col-span-2"` on `<Field>`.
- KPI rows: `grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-4` (adjust the last number). `<KpiCard to="/path">` makes a card a link.
- Toast: `useToast()` (bottom-center on phones).

## 7. Links and breadcrumbs
- All in-app URLs come from `src/lib/links.ts` (`merchantPath(id)`, `supportPath(id)`, `subscriptionPath(merchantId)`, `invoicePath(merchantId, no?)`, `onboardingPath(merchantId)`, `activityPath(merchantId)`, `contactsPath(q?)`, `ROUTES.*`, `newPath(section)`). Never concatenate route strings by hand.
- **Rule: every merchant name or code, anywhere (tables, cards, detail pages, feeds), is a `<Link to={merchantPath(id)}>`.** Do not nest a link inside another link/button; make the row/card title one link and the merchant name a sibling link (see `Overview.tsx`). `onClick={() => navigate(...)}` on a whole `<tr>` is fine as an extra affordance, but the name itself must still be a real `<Link>` (middle-click/open-in-new-tab works) with `onClick={e => e.stopPropagation()}`.
- Breadcrumb: `useBreadcrumb(crumbs)` (`src/lib/layoutContext.ts`). Crumbs are `string | { label, to? }`; the "Tổng quan" root (links to `/`) is added by the shell. Plain strings are auto-linked by position to the URL prefix (`/support/:id` -> crumb 0 = `/support`; `/subscriptions/:mid/invoice` -> crumb 1 = `/subscriptions/:mid`); the last crumb is the current page. Use explicit `{ label, to }` when a crumb does not map to a URL prefix (e.g. `[{ label: 'Hồ sơ Merchant', to: '/merchants' }, m.name]`). Section list pages need nothing (defaults exist).
- Unknown routes render `NotFound` inside the shell.

## 8. `?new=1` convention (quick actions from Tổng quan)
Links: `/merchants?new=1`, `/support?new=1`, `/contacts?new=1`, `/subscriptions?new=1` (also available: onboarding, promotions, faq via `newPath(...)`).
Each list page that has a "create" button must call, once:
```tsx
import { useNewParam } from '../lib/useNewParam'
useNewParam(() => setAdding(true))   // opens the same create modal as the primary button
```
The hook runs on mount when `?new=1` is present, then removes the param (replace). `onNew` must be idempotent. Pages that have no create flow need nothing.
Similarly `/contacts?q=<code>` pre-fills the search box (`useSearchParams`), and `/subscriptions/:mid/invoice?no=<number>` selects an invoice.

## 9. No dead controls
Every button/link/input either does something real or is removed, or is `disabled` with a `title` explaining why ("Sắp ra mắt"). No `href="#"`, no empty `onClick`, no cursor-pointer on static text. Destructive actions confirm. Every mutation shows a toast (success and failure text). Every fetch has Loading / ErrorState (with retry) / EmptyState.

## 10. Shell facilities pages can rely on
`useSettings()` (`src/lib/settings.ts`: name, role, pageSize, compact), `useToast`, `useBreadcrumb`, `useNewParam`, `useScrollLock`, `useDismiss` (popovers), `ResponsiveTable`/`MobileCard`, `PageHeader`, `FormGrid`/`Field`, `KpiCard`, `Pagination`, `SearchInput`, `StatusBadge`, `Loading/ErrorState/EmptyState`.
