# frontend — SwiftBite

React + Vite + Tailwind v4 + Redux Toolkit + TanStack Query. Dev server on **5173**.

## Routes

| Path | Access | Notes |
|------|--------|-------|
| `/` | public | menu with category tabs, guest cart |
| `/cart` | public | quantities, totals |
| `/checkout` | login | address form, single multi-line POST, confirmation |
| `/confirmation` | login | order IDs |
| `/orders` | login | history with status filter tabs, server paginated |
| `/orders/:id` | login | lines, live status timeline (3s poll), cancel while pending |
| `/login`, `/register` | guest | JWT in Redux + localStorage, 401 auto-logout |
| `/admin` | admin | dashboard stats, menu management (categories, items) |

State split: TanStack Query owns server data, Redux owns session, cart, and UI.
Brand tokens live in `src/index.css` (`@theme`): `primary`, `primary-dark`,
`primary-soft`, `paper`.

## Environment

| Var | Notes |
|-----|-------|
| `VITE_AUTH_URL` | default `/api/auth`, proxied to :3000 in dev |
| `VITE_ITEM_URL` | default `/api/items`, proxied to :3001 in dev |
| `VITE_ORDERS_URL` | default `/api/orders`, proxied to :3002 in dev |

## Scripts

```bash
pnpm install
pnpm dev      # local dev with API proxy, no CORS changes needed
pnpm build    # typecheck + production bundle
```
