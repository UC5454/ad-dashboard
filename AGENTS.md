# AGENTS.md - Ad Dashboard Implementation Guide for Codex

## Overview

広告ダッシュボード（Google Ads + Meta Ads 統合管理）のフロントエンドUI全実装。
バックエンド（API Routes, lib/, pipeline/）は**全て実装済み**。Codexの仕事は**フロントエンドのUI画面・コンポーネントの実装のみ**。

**重要**: 既存のバックエンドコードは一切変更しないこと。

## Tech Stack (already installed)

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.1.6 | Framework (App Router) |
| react / react-dom | 19.2.3 | UI |
| tailwindcss | ^4 | Styling (Tailwind CSS v4) |
| recharts | ^3.7.0 | Charts & graphs |
| next-auth | ^5.0.0-beta.30 | Authentication (already configured) |
| jspdf | ^4.2.0 | PDF generation |
| html2canvas | ^1.4.1 | HTML to canvas for PDF |
| better-sqlite3 | ^12.6.2 | DB (already configured) |
| bcryptjs | ^3.0.3 | Password hashing (already configured) |
| uuid | ^13.0.0 | ID generation |

## Project Structure

```
ad-dashboard/
├── app/
│   ├── layout.tsx                    # ✅ DONE - Root layout
│   ├── page.tsx                      # ✅ DONE - Redirect logic
│   ├── globals.css                   # 🔧 UPDATE - Add design system tokens
│   ├── login/
│   │   └── page.tsx                  # ✅ DONE - Login page
│   ├── dashboard/
│   │   ├── layout.tsx                # 🆕 TO BE IMPLEMENTED - Sidebar + Header layout
│   │   ├── page.tsx                  # 🆕 TO BE IMPLEMENTED - Main dashboard
│   │   ├── clients/
│   │   │   └── [clientId]/
│   │   │       └── page.tsx          # 🆕 TO BE IMPLEMENTED - Client detail
│   │   ├── compare/
│   │   │   └── page.tsx              # 🆕 TO BE IMPLEMENTED - Platform comparison
│   │   ├── alerts/
│   │   │   └── page.tsx              # 🆕 TO BE IMPLEMENTED - Alert history
│   │   └── reports/
│   │       └── page.tsx              # 🆕 TO BE IMPLEMENTED - Report generation
│   ├── settings/
│   │   ├── layout.tsx                # 🆕 TO BE IMPLEMENTED - Settings layout (reuse Sidebar)
│   │   ├── page.tsx                  # 🆕 TO BE IMPLEMENTED - Settings top (redirect)
│   │   ├── api-keys/
│   │   │   └── page.tsx              # 🆕 TO BE IMPLEMENTED - API key management
│   │   ├── clients/
│   │   │   └── page.tsx              # 🆕 TO BE IMPLEMENTED - Client management
│   │   └── users/
│   │       └── page.tsx              # 🆕 TO BE IMPLEMENTED - User management
│   └── api/                          # ✅ ALL DONE - DO NOT MODIFY
│       ├── auth/[...nextauth]/route.ts
│       ├── clients/route.ts
│       ├── api-keys/route.ts
│       ├── dashboard/route.ts
│       ├── alerts/route.ts
│       └── reports/route.ts
├── components/
│   ├── auth/
│   │   └── SessionProvider.tsx       # ✅ DONE
│   ├── ui/                           # 🆕 TO BE IMPLEMENTED
│   │   └── Sidebar.tsx               # Sidebar navigation component
│   └── dashboard/                    # 🆕 TO BE IMPLEMENTED
│       ├── BigKpiCards.tsx            # BIG 4 KPI cards
│       ├── ClientTable.tsx            # Client list table with sort/filter
│       ├── DailyTrendChart.tsx        # Daily trend chart (Recharts)
│       ├── BudgetProgress.tsx         # Budget consumption progress bar
│       └── AlertBanner.tsx            # Alert notification banner
├── lib/                              # ✅ ALL DONE - DO NOT MODIFY
│   ├── auth.ts
│   ├── db.ts
│   ├── crypto.ts
│   ├── alerts.ts
│   └── slack.ts
├── pipeline/                         # ✅ ALL DONE - DO NOT MODIFY
├── migrations/
│   └── schema.sql                    # ✅ DONE
└── DEVELOPMENT.md                    # Full specification reference
```

## Design System

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Navy | #1B2A4A | Primary dark, sidebar bg, headings |
| Navy Light | #243556 | Sidebar hover |
| Navy Dark | #131E36 | Sidebar active |
| Blue | #2C5282 | Primary actions, buttons, links |
| Blue Light | #3B6BA5 | Hover states |
| White | #FFFFFF | Card backgrounds |
| Light Gray | #F8FAFC | Page background |
| Gray 100 | #F1F5F9 | Table row hover |
| Gray 200 | #E2E8F0 | Borders |
| Gray 400 | #94A3B8 | Secondary text |
| Gray 500 | #64748B | Muted text |
| Gray 700 | #334155 | Body text |
| Emerald | #059669 | Positive changes, success |
| Red | #DC2626 | Negative changes, errors, critical alerts |
| Amber | #D97706 | Warnings |

### Typography

- Font: Inter (already loaded via next/font/google in layout.tsx)
- Headings: font-bold, text-navy
- Body: text-gray-700
- Secondary: text-gray-500
- Numbers/Currency: tabular-nums for alignment

### Component Style Rules

- Cards: `bg-white rounded-xl shadow-sm p-5`
- Buttons primary: `bg-blue text-white rounded-lg px-4 py-2.5 hover:bg-blue-light`
- Buttons secondary: `border border-gray-200 bg-white rounded-lg px-4 py-2.5 hover:bg-gray-50`
- Input fields: `border border-gray-200 rounded-lg px-3 py-2 focus:border-blue focus:ring-1 focus:ring-blue`
- Tables: `bg-white rounded-xl shadow-sm overflow-hidden`
- Badge success: `bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full`
- Badge warning: `bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full`
- Badge error: `bg-red-50 text-red-700 text-xs px-2 py-0.5 rounded-full`

## Implementation Tasks (in order)

### Phase 1: globals.css + Dashboard Layout + Sidebar

**File: `app/globals.css`** — Update with design tokens:
```css
@import "tailwindcss";

@theme inline {
  --color-navy: #1B2A4A;
  --color-navy-light: #243556;
  --color-navy-dark: #131E36;
  --color-blue: #2C5282;
  --color-blue-light: #3B6BA5;
  --color-blue-dark: #1E3A5F;
  --font-sans: var(--font-inter), system-ui, sans-serif;
}

body {
  font-family: var(--font-sans);
}
```

**File: `components/ui/Sidebar.tsx`** — Sidebar navigation:
- Fixed left sidebar, 256px wide, bg-navy, full height
- Logo area at top: "AD" badge + "広告ダッシュボード" + "Digital Gorilla"
- Navigation sections:
  - メニュー: ダッシュボード, 媒体比較, アラート, レポート
  - 設定: APIキー管理, クライアント管理, ユーザー管理
- Each nav item: icon (SVG path) + label, active state with bg-blue
- Dashboard link should also be active when on `/dashboard/clients/*`
- Bottom: user avatar (first letter), name, email, logout button
- Uses `usePathname()` for active state detection
- Uses `signOut` from next-auth/react

**File: `app/dashboard/layout.tsx`** — Dashboard layout:
- Server component, checks auth with `auth()`, redirects to /login if not authenticated
- Renders `<Sidebar />` + `<main className="ml-64 min-h-screen p-6 bg-gray-50">`

**File: `app/settings/layout.tsx`** — Same as dashboard layout (reuse Sidebar)

### Phase 2: Main Dashboard Page

**File: `app/dashboard/page.tsx`** — "use client"
- Fetches `GET /api/dashboard?period={period}`
- Period selector: "今月" (current_month) / "過去30日" (last_30)
- Page header: "ダッシュボード" + period date range + period selector dropdown
- Loading state: centered spinner
- Components: `<BigKpiCards>`, `<ClientTable>`, `<DailyTrendChart>`

**File: `components/dashboard/BigKpiCards.tsx`** — BIG 4 KPI Cards:
- Grid: 4 columns on lg, 2 on sm, 1 on mobile
- Cards: 総消化額, 総CV数, 平均CPA, 平均ROAS
- Each shows: label (gray-500), value (2xl bold navy), change % vs previous period
- Change indicator: up arrow = green (for CV/ROAS), down arrow = red (for CV/ROAS)
- For cost/CPA: up = red (bad), down = green (good) — inverted logic
- Format: currency with ¥ + commas, ROAS with 2 decimals + "x"

**File: `components/dashboard/ClientTable.tsx`** — Client list table:
- Sortable columns: name, cost, CV, CPA, ROAS, CTR
- Columns: クライアント名, 予算, 消化額, 消化率(progress bar), CV, CPA, ROAS, ステータス
- Status badge: active=green, paused=yellow, archived=gray
- Budget = monthly_budget_google + monthly_budget_meta
- Budget progress bar: green (< 80%), yellow (80-100%), red (> 100%)
- Click on row → navigate to `/dashboard/clients/{id}`
- Format numbers with ¥ and commas

**File: `components/dashboard/DailyTrendChart.tsx`** — Recharts chart:
- Tab selector: 消化額 / CV数 / CPA
- Line chart with area fill
- X axis: dates, Y axis: values
- Colors: Blue (#2C5282) for line, light blue fill
- Tooltip with formatted values
- Responsive container

### Phase 3: Client Detail Page

**File: `app/dashboard/clients/[clientId]/page.tsx`** — "use client"
- Fetches `GET /api/reports?clientId={id}&period={YYYY-MM}`
- Period selector (month picker)
- Back button → /dashboard
- Client name as page title
- Platform summary cards (Google Ads / Meta Ads side by side):
  - Each shows: cost, impressions, clicks, CTR, conversions, CPA, ROAS
- Daily trend chart (same component, pass data)
- Campaign breakdown table:
  - Columns: キャンペーン名, 媒体, 消化額, CV, CPA, ROAS, CTR
  - Sortable, grouped by platform

### Phase 4: Platform Comparison Page

**File: `app/dashboard/compare/page.tsx`** — "use client"
- Fetches `GET /api/dashboard?period={period}`
- Split view: Google Ads vs Meta Ads
- For each platform, compute totals from clients data
- Comparison metrics: 消化額, CV, CPA, ROAS, CTR
- Bar chart comparing the two platforms (Recharts BarChart)
- Table with side-by-side comparison

### Phase 5: Alert History Page

**File: `app/dashboard/alerts/page.tsx`** — "use client"
- Fetches `GET /api/alerts?limit=100`
- Filter by severity: all / warning / critical
- Filter by client (dropdown)
- Table: 日時, クライアント, 媒体, 指標, レベル, 現在値, 移動平均, 乖離率, メッセージ
- Severity badge: warning=yellow, critical=red
- "解決済み" button → `PATCH /api/alerts` with { id }
- Resolved alerts shown with strikethrough/muted style

### Phase 6: Report Generation Page

**File: `app/dashboard/reports/page.tsx`** — "use client"
- Client selector dropdown (fetch from `/api/clients`)
- Period selector (YYYY-MM)
- "レポート生成" button
- Fetches `GET /api/reports?clientId={id}&period={period}` for data
- Renders report preview in HTML:
  - Executive summary with BIG KPIs
  - Platform comparison table
  - Daily trend chart
  - Campaign breakdown table
- "PDF ダウンロード" button: uses jsPDF + html2canvas to capture the preview div
- Posts `POST /api/reports` to record generation history

### Phase 7: API Key Management Page

**File: `app/settings/api-keys/page.tsx`** — "use client"
- Admin only (check session role, show "権限がありません" for non-admin)
- Fetches `GET /api/api-keys`
- Table: キー名, プラットフォーム, 作成日
- "新規登録" button → opens modal
- Modal:
  - Platform toggle: Google Ads / Meta Ads
  - Google Ads fields: developer_token, client_id, client_secret, refresh_token, login_customer_id
  - Meta Ads fields: app_id, app_secret, access_token
  - All fields are password type (hidden by default) with show/hide toggle
  - "保存" button → `POST /api/api-keys`
- Delete button on each row → `DELETE /api/api-keys?id={id}` with confirmation

### Phase 8: Client Management Page

**File: `app/settings/clients/page.tsx`** — "use client"
- Admin/editor only
- Fetches `GET /api/clients`
- Table: クライアント名, Google Ads ID, Meta Ads ID, 月予算(Google), 月予算(Meta), ステータス
- "新規登録" button → inline form or modal
- Form fields: name, google_ads_account_id, meta_ads_account_id, monthly_budget_google, monthly_budget_meta
- "保存" → `POST /api/clients`

### Phase 9: User Management Page

**File: `app/settings/users/page.tsx`** — "use client"
- Admin only
- Fetches users from API (add `GET /api/users` route if needed)
- Table: 名前, メール, ロール, 作成日
- Role badge: admin=blue, editor=green, viewer=gray
- NOTE: If `/api/users` doesn't exist, create it:
  ```typescript
  // app/api/users/route.ts
  import { NextResponse } from "next/server";
  import { auth } from "@/lib/auth";
  import { getDb } from "@/lib/db";

  export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = (session.user as Record<string, unknown>).role;
    if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const db = getDb();
    const users = db.prepare("SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC").all();
    return NextResponse.json(users);
  }
  ```

### Phase 10: Settings Top Page

**File: `app/settings/page.tsx`**
- Simple redirect to `/settings/api-keys` or a settings overview with links to sub-pages

## API Endpoints Reference (DO NOT MODIFY existing routes)

| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| GET | /api/dashboard?period=current_month&clientId=xxx | Query params | { kpi: { current, previous }, clients: [], dailyTrend: [], period } |
| GET | /api/clients | - | Client[] |
| POST | /api/clients | { name, google_ads_account_id, meta_ads_account_id, monthly_budget_google, monthly_budget_meta } | Client |
| GET | /api/api-keys | - | { id, platform, key_name, created_at }[] (admin only) |
| POST | /api/api-keys | { platform, key_name, credentials: {...} } | { id, platform, key_name } (admin only) |
| DELETE | /api/api-keys?id=xxx | Query param | { success: true } (admin only) |
| GET | /api/alerts?clientId=xxx&severity=warning&limit=50 | Query params | Alert[] |
| PATCH | /api/alerts | { id } | { success: true } |
| GET | /api/reports?clientId=xxx&period=2026-02 | Query params | { client, period, platformSummary, dailyTrend, campaigns } |
| POST | /api/reports | { clientId, period } | { success: true } |

## Design Rules (DO NOT CHANGE)

1. **DO NOT modify** any files in `lib/`, `pipeline/`, `migrations/`, or `app/api/`
2. **DO NOT change** the login page (`app/login/page.tsx`)
3. **DO NOT change** the root layout (`app/layout.tsx`) or root page (`app/page.tsx`)
4. **Color scheme**: Navy (#1B2A4A) / Blue (#2C5282) / White / Light Gray — no other primary colors
5. **Font**: Inter only
6. **All text in Japanese** (labels, headings, placeholders, error messages)
7. **Currency format**: ¥ prefix + comma-separated integers (e.g., ¥1,234,567)
8. **Percentage format**: 1 decimal place + % suffix (e.g., 12.3%)
9. **ROAS format**: 2 decimal places + x suffix (e.g., 3.45x)
10. Use `"use client"` directive only where needed (interactive pages)
11. Desktop-first layout (sidebar is always visible, 256px wide)

## Key Behavioral Rules

1. All authenticated routes must check session via `auth()` (server) or `useSession()` (client)
2. Dashboard layout redirects to /login if not authenticated
3. Settings pages check role — admin-only pages show "権限がありません" for non-admin users
4. API key credentials are NEVER displayed in the UI (only key_name and platform)
5. Client table rows are clickable, navigating to detail page
6. All number formatting uses Japanese locale with appropriate separators

## Testing Checklist

- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] Login page renders correctly
- [ ] Dashboard layout shows sidebar + main content area
- [ ] Dashboard page loads with KPI cards, client table, daily chart
- [ ] Client detail page renders platform summary + campaign table
- [ ] Platform comparison page shows Google vs Meta side-by-side
- [ ] Alert history page renders with filter controls
- [ ] Report page generates PDF download
- [ ] API key management works (CRUD operations)
- [ ] Client management works (list + create)
- [ ] User management page renders (admin only)
- [ ] All pages use Navy/Blue/White color scheme
- [ ] All text is in Japanese
- [ ] Sidebar navigation highlights active page correctly
