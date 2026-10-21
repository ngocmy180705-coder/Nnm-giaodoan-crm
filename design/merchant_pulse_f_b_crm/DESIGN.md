---
name: Merchant Pulse F&B CRM
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#5b4137'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#907065'
  outline-variant: '#e4beb1'
  surface-tint: '#a83900'
  primary: '#a83900'
  on-primary: '#ffffff'
  primary-container: '#ff5b00'
  on-primary-container: '#521800'
  inverse-primary: '#ffb59a'
  secondary: '#5b5e67'
  on-secondary: '#ffffff'
  secondary-container: '#dfe2ec'
  on-secondary-container: '#61646d'
  tertiary: '#006c49'
  on-tertiary: '#ffffff'
  tertiary-container: '#00a773'
  on-tertiary-container: '#003320'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbce'
  primary-fixed-dim: '#ffb59a'
  on-primary-fixed: '#380d00'
  on-primary-fixed-variant: '#802a00'
  secondary-fixed: '#dfe2ec'
  secondary-fixed-dim: '#c3c6d0'
  on-secondary-fixed: '#181c23'
  on-secondary-fixed-variant: '#43474f'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.875rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system is tailored for an enterprise-grade Merchant Operations & Partner Relationship Management (CRM) platform in the Food & Beverage industry. The brand embodies dynamic operational efficiency, culinary hospitality, and executive-level clarity.

### Target Audience & Emotional Intent
- **Users:** Operations managers, merchant acquisition specialists, and support admins overseeing hundreds of culinary brands, branches, and regional accounts.
- **Tone & Mood:** Energetic, disciplined, trustworthy, and high-velocity.
- **Aesthetic Movement:** Corporate Modern paired with a Dark-Nav / Bright-Canvas hybrid architecture. The dark slate sidebar provides stable grounding, while energetic solar orange accents inject urgency, vitality, and F&B culinary passion against a crisp, low-glare operational surface.

## Colors

The palette balances vibrant culinary accents with high-legibility enterprise work surfaces:

- **Primary (`#FF5B00`):** Energetic F&B Orange. Used for primary CTAs, active segmented tabs, table header highlights, key selection rings, and prominent metrics.
- **Secondary (`#1E2229`):** Carbon Deep Charcoal. Applied across navigation rails, app shells, and dominant structural frames to anchor the eye and reduce ocular fatigue during 8+ hour operational shifts.
- **Tertiary (`#10B981`):** Operational Success Green. Reserved for online merchant status, active approvals, positive metrics, and compliant validation states.
- **Neutral (`#64748B`):** Muted slate. Guides secondary hierarchy, column headers, meta-labels, and subtle boundary dividers.

### Canvas & Surface Structure
- **App Canvas:** `#F8F9FA` for clean, distraction-free table readability.
- **Card / Table Surface:** `#FFFFFF` with precise, razor-sharp 1px dividers (`#E2E8F0`).
- **Sidebar Surface:** Deep Onyx (`#181B20`) with `#252A32` active pill states and pure white or branded icons.

## Typography

Typography prioritizes fast scanning, numerical parity, and Vietnamese diacritic clarity:

- **Headlines (`Plus Jakarta Sans`):** Modern geometric grotesk delivering friendly authority for screen headers, KPI rollups, and drawer titles.
- **Body & Labels (`Be Vietnam Pro`):** Engineered natively for flawless Vietnamese accent positioning, optical legibility in dense data tables, and compact merchant attribute formatting.
- **Tabular Figures:** Numbers (IDs, phone numbers, transaction revenues in VND) must utilize `font-variant-numeric: tabular-nums` to guarantee straight vertical scanning down table columns.

## Layout & Spacing

The layout is constructed as a dual-pane responsive administrative console:

- **Sidebar Navigation:** Fixed width at `64px` (collapsed icon-rail mode) expanding to `240px` on demand.
- **Top Utility Bar:** Fixed `64px` height containing context switchers, timezones (`GMT+7`), notification pings, language selectors, and admin profiles.
- **Main Viewport Canvas:** Fluid layout stretching between `1280px` and `1920px+` ultra-widescreen monitors. Outer margin is locked to `1.5rem` (`24px`).
- **Data Table Grids:** Compact vertical density with row heights standardized to `52px` to maximize data display per viewport while maintaining touch and click accessibility.

## Elevation & Depth

Visual hierarchy leverages functional, low-glare surface layering:

- **Level 0 (Base Canvas):** Background tone `#F8F9FA`.
- **Level 1 (Cards, Workspaces, Table Containers):** Pure `#FFFFFF` surface bounded by a crisp 1px stroke (`#E5E7EB`), avoiding blurry cast shadows to prevent visual noise in data-heavy screens.
- **Level 2 (Popovers, Filter Menus, Datepickers):** `#FFFFFF` paired with an ambient shadow: `0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Modals & Slide-over Inspection Drawers):** High-contrast scrim `rgba(15, 23, 42, 0.45)` with soft edge illumination.

## Shapes

The interface balances structured geometric utility with friendly rounded touchpoints:

- **Standard Buttons & Inputs:** `8px` (`roundedness: 2`) border-radius for modern, accessible targets.
- **Pill Badges & Segmented Controls:** Specialized `9999px` full-radius pills for table status indicators ("Hoạt động", "Tạm dừng") and top-level mode switchers.
- **Data Tables & Cards:** `10px` to `12px` external corner radii with clipped container borders.

## Components

### 1. Data Tables
- **Header:** Filled with vibrant Brand Orange (`#FF5B00`) with high-contrast white text (`#FFFFFF`, semi-bold `13px`), or soft neutral (`#F1F5F9` with dark text) depending on view hierarchy. Column text aligned left; financial values (MCA, doanh thu) and statuses aligned right/center.
- **Rows:** Alternating subtle hover states (`#FFF8F5` with a `2px` left brand border indicator). Clean 1px bottom border (`#F1F5F9`).

### 2. Status Chips & Badges
- **Active ("Hoạt động"):** Light mint background (`#ECFDF5`), bold emerald text (`#059669`), paired with a 6px solid emerald status dot or checkmark.
- **Inactive / Suspended:** Soft rose background (`#FFF1F2`) with red slate text (`#E11D48`).
- **Pending Review:** Warm amber background (`#FFFBEB`) with dark gold text (`#D97706`).

### 3. Segmented Views & Tabs
- Encapsulated pill switchers (e.g., "Cửa hàng" vs. "Yêu cầu rời chương trình") housed in an outlined container.
- Active tab features full solid primary fill (`#FF5B00`), white typography, and white SVG icons. Inactive tabs display clean charcoal text with transparent backgrounds.

### 4. Action Buttons
- **Primary Action (e.g., "+ Cửa hàng"):** Solid `#FF5B00`, white text, soft orange glow on focus.
- **Secondary Action (e.g., "Xuất file Excel"):** Warm orange background tint (`#FF5B00` or `#FF8A00`), distinct white iconography, clear tactile feedback on press.
- **Outlined / Tertiary:** 1px slate border (`#CBD5E1`) with dark text (`#334155`) for table pagination and inline filters.

### 5. Input & Search Bars
- Search inputs incorporate leading search glyphs, a subtle inset placeholder ("Tìm kiếm theo tên cửa hàng, số điện thoại..."), and an instant search keyboard shortcut tag (`⌘K`). Focus state activates an orange outline ring (`box-shadow: 0 0 0 3px rgba(255, 91, 0, 0.15)`).

### 6. Left Dark Navigation Rail
- Compact dark vertical bar with high-contrast icons. Active items are encapsulated in a bright orange circular/squircle tile, clearly highlighting current context at a glance.