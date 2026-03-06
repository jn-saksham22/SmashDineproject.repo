# SmashDine - Enterprise QR Restaurant Platform PRD

## Problem Statement
Build an enterprise QR-based restaurant/cafe ordering platform where customers order food by scanning a QR code on the table. Supports multiple restaurants with owner dashboards. Customers never need to login/register — access is purely via QR code scanning.

## Architecture
- **Frontend**: React + Tailwind CSS + shadcn/ui components
- **Backend**: FastAPI (Python) + MongoDB
- **Auth**: JWT tokens for owner accounts
- **Database**: MongoDB (Motor async driver)
- **QR Codes**: Backend-generated base64 PNG images
- **Payment**: Simulated payment gateway with countdown

## User Personas
1. **Restaurant Customer** — Scans QR code at table, orders food, plays game, tracks order (no login)
2. **Restaurant Owner** — Logs in, manages menu/orders/tables, views analytics

## Pages Built

### Customer Flow
| Page | Route | Description |
|------|-------|-------------|
| Landing | `/` | SmashDine home with feature overview and owner CTAs |
| Menu | `/menu?rid=<id>&table=<num>` | Full restaurant menu with cart |
| Checkout | `/checkout` | Cart summary + GST 18% + payment method select |
| Game | `/game?orderId=&total=&name=` | Smash Kart HTML5 canvas game |
| Order Tracking | `/order/:orderId` | Live order status + ETA |

### Owner Flow
| Page | Route | Description |
|------|-------|-------------|
| Login | `/owner/login` | JWT-based owner login |
| Register | `/owner/register` | New restaurant registration (auto-seeds menu) |
| Dashboard | `/owner/dashboard` | Overview metrics + recent orders |
| Live Orders | `/owner/orders` | Real-time order list with status controls |
| Menu Management | `/owner/menu` | CRUD for categories and menu items |
| Table/QR Management | `/owner/tables` | QR code generation & download for 50 tables |
| Analytics | `/owner/analytics` | Revenue charts, top items, game stats |

## API Endpoints

### Auth
- `POST /api/auth/register` — Owner + Restaurant registration (auto-seeds menu)
- `POST /api/auth/login` — Owner login → JWT token

### Public (Customer)
- `GET /api/restaurant/{id}` — Restaurant info
- `GET /api/menu/{restaurant_id}` — Full menu with categories
- `GET /api/qr/{restaurant_id}/{table_number}` — QR code as base64 PNG
- `POST /api/orders` — Create order
- `GET /api/orders/{order_id}` — Get order status + tracking
- `POST /api/payments/simulate` — Simulated payment confirmation
- `POST /api/game/result` — Save Smash Kart game result
- `GET /api/game/result/{order_id}` — Get game result

### Owner (JWT Protected)
- `GET /api/owner/profile` — Owner + restaurant info
- `PUT /api/owner/restaurant` — Update restaurant details
- `GET /api/owner/categories` / `POST` / `PUT` / `DELETE` — Category CRUD
- `GET /api/owner/menu-items` / `POST` / `PUT` / `DELETE` — Menu item CRUD
- `GET /api/owner/orders` — All orders (filterable by status)
- `PUT /api/owner/orders/{id}/status` — Update order status
- `GET /api/owner/analytics` — Revenue, top items, game stats
- `POST /api/owner/seed-menu` — Re-seed demo menu items

## Database Schema (MongoDB Collections)
- `owners` — Owner accounts (email, password_hash, restaurant_id)
- `restaurants` — Restaurant info (name, description, address, cuisine_type)
- `categories` — Menu categories (restaurant_id, name, sort_order)
- `menu_items` — Food items (restaurant_id, category_id, name, price, image_url, prep_time_minutes, item_type, is_available)
- `orders` — Customer orders (order_id, restaurant_id, table_number, items[], subtotal, gst_amount, total, status, estimated_ready_at)
- `payments` — Payment records (order_id, amount, method, txn_id, status)
- `game_results` — Game outcomes (order_id, player_name, won, coupon_code, reward_type)

## Game Mechanics (Smash Kart) — v2 (3-Round System)
- HTML5 Canvas game, runs in browser
- Player (orange kart) vs Enemy (red kart) — horizontal arena
- Arrow keys / drag to move up/down; Click / Space / tap to shoot
- **3 Rounds — must win ALL 3 to claim reward (~50% success rate)**

| Round | Label | Enemy HP | Fire Rate | Bullet DMG | Special |
|-------|-------|----------|-----------|------------|---------|
| 1 | Challenger | 105 | 1.65s | 13 | Normal |
| 2 | Veteran | 155 | 1.1s | 17 | Faster, more accurate |
| 3 | BOSS | 200 | 0.82s | 21 | Double bullets, enrages at 30% HP |

- **Player HP carries over** between rounds (+28 recovery after each win)
- **Player Power (damage per shot) based on order total:**
  - < ₹300 → 7 damage/shot (LOW)
  - ₹300–₹700 → 11 damage/shot (MED)
  - ₹700–₹1500 → 16 damage/shot (HIGH)
  - > ₹1500 → 23 damage/shot (ULTRA)
- **Boss Enrage**: At 30% HP, boss fires 3 bullets/burst with 0.37s interval
- **Screen shake** on player hit; **danger flash** when HP < 25

## Reward System
- Win with total < ₹500 → 10% Discount coupon
- Win with total ₹500–₹1500 → 2 Free Drinks + coupon
- Win with total > ₹1500 → 10% Discount + 2 Free Drinks + coupon
- Coupon format: `SMASH-XXXX-XXXX`

## Prep Time Estimation
- Drinks: 1–2 min
- Shakes: 3–4 min
- Fast food: 7–10 min
- Algorithm: max(first_item_time) + 0.4 × sum(remaining) → capped at 40 min

## What's Implemented (v1.0) — June 2024
- [x] Complete customer ordering flow (QR → Menu → Cart → Payment → Game → Tracking)
- [x] Smash Kart HTML5 canvas game with power system
- [x] Reward + coupon generation system
- [x] Multi-restaurant support with JWT auth
- [x] Auto-seed 5 categories + 19 menu items on registration
- [x] 50-table QR code generation + download
- [x] Real-time order tracking (auto-refresh every 15s)
- [x] Owner dashboard with live orders + status management
- [x] Revenue analytics with recharts graphs
- [x] Simulated payment with GST (18%) calculation

## Prioritized Backlog

### P0 — Critical (Next Sprint)
- [ ] Real Razorpay/Stripe payment integration
- [ ] Real-time notifications (WebSocket) for owner when new order arrives
- [ ] Order cancellation by owner

### P1 — High Priority
- [ ] Customer can print/share order receipt
- [ ] Owner can customize restaurant branding/logo
- [ ] Multiple menu variants (half/full portions)
- [ ] Estimated prep time display improvements (per-item breakdown)
- [ ] Mobile push notifications for order ready

### P2 — Nice to Have
- [ ] Customer feedback/rating system
- [ ] Loyalty points system
- [ ] Owner can offer time-limited specials
- [ ] Multi-language support (Hindi, Tamil, etc.)
- [ ] Dark mode for customer menu
- [ ] Print QR codes in bulk as PDF

## Design Guidelines
- Customer theme: Warm orange (#F97316) + red (#DC2626) on cream (#FFF7ED)
- Owner theme: Emerald (#10B981) + slate on white (#F8FAFC)
- Fonts: Fraunces (customer headings), Nunito (customer body), Plus Jakarta Sans (owner headings), Inter (owner body)
