# Phase 1 — Foundation

> **Status:** ✅ Complete  
> **Timeline:** Weeks 1–4  
> **Goal:** Set up the monorepo, scaffold all microservices, and establish the project foundation.

---

## What Has Been Built

### Monorepo Structure (npm Workspaces)

```
E_Commerce/
│
├── package.json              ← Root workspace config
├── tsconfig.base.json        ← Shared TypeScript settings
├── .gitignore
├── PRD_Event_Driven_ECommerce.md
│
├── gateway/                  ← API Gateway         (port 4000)
├── user-service/             ← User Service         (port 4005)
├── order-service/            ← Order Service        (port 4001)
├── payment-service/          ← Payment Service      (port 4002)
├── inventory-service/        ← Inventory Service    (port 4003)
├── notification-service/     ← Notification Service (port 4004)
└── frontend/                 ← Next.js Storefront   (port 3000)
```

### Each Backend Service Includes

```
service-name/
├── src/
│   ├── config/index.ts              # Environment variables & config
│   ├── controllers/
│   │   └── health.controller.ts     # Health check handler
│   ├── middlewares/
│   │   └── error.middleware.ts      # Centralised error handler
│   ├── routes/
│   │   ├── index.ts                 # Route aggregator
│   │   └── health.routes.ts         # GET /api/health
│   ├── models/                      # Database models (empty, ready)
│   ├── services/                    # Business logic (empty, ready)
│   ├── events/
│   │   ├── producers/               # Kafka producers (empty, ready)
│   │   └── consumers/               # Kafka consumers (empty, ready)
│   ├── utils/
│   │   └── logger.ts                # Pino structured logger
│   └── index.ts                     # Express server entry point
├── package.json
├── tsconfig.json
├── nodemon.json
└── .env.example
```

### Tech Used Per Service

| Service | Framework | Database | Message Broker | Extras |
|---|---|---|---|---|
| Gateway | Express + TypeScript | — | — | Rate limiting, HTTP proxy |
| User Service | Express + TypeScript | PostgreSQL | Kafka | bcrypt, JWT |
| Order Service | Express + TypeScript | PostgreSQL | Kafka | Zod validation |
| Payment Service | Express + TypeScript | PostgreSQL | Kafka | Zod validation |
| Inventory Service | Express + TypeScript | PostgreSQL | Kafka | Zod validation |
| Notification Service | Express + TypeScript | MongoDB | Kafka | Zod validation |
| Frontend | Next.js 16 (TypeScript) | — | — | App Router, Tailwind |

---

## How to Run

```bash
# Install all dependencies (run once from root)
npm install

# Start any service individually
npm run dev:gateway        # http://localhost:4000
npm run dev:users          # http://localhost:4005
npm run dev:orders         # http://localhost:4001
npm run dev:payments       # http://localhost:4002
npm run dev:inventory      # http://localhost:4003
npm run dev:notifications  # http://localhost:4004
npm run dev:frontend       # http://localhost:3000
```

Each service has a health check endpoint you can test:

```bash
# Example: test the user service
curl http://localhost:4005/api/health

# Response:
# {
#   "success": true,
#   "service": "user-service",
#   "status": "healthy",
#   "timestamp": "2026-04-16T08:40:17.272Z",
#   "uptime": 1.23
# }
```

---

## Service Use Cases (Beginner Guide)

### 1. 🚪 Gateway Service

**What it does:**  
The Gateway is the **single entry point** for all client requests. It sits in front of every other service. Clients never talk to backend services directly — they always go through the Gateway.

**Think of it like:**  
A reception desk at a hospital. You don't walk directly to a doctor — you go to the reception, and they send you to the right department.

**Use Cases:**

| # | Use Case | What Happens |
|---|---|---|
| 1 | **Route a request** | Client calls `GET /api/orders/123` → Gateway forwards it to Order Service |
| 2 | **Rate limiting** | If a user sends too many requests (100 per minute), Gateway blocks them with a `429 Too Many Requests` |
| 3 | **Health check** | `GET /api/health` → Returns gateway status without hitting any backend service |
| 4 | **Service unavailable** | If Order Service is down, Gateway returns `502 Bad Gateway` with a friendly error message |

**Key Files:**
- `src/routes/proxy.routes.ts` — defines which URL path maps to which service
- `src/config/index.ts` — stores the URLs of all downstream services

---

### 2. 👤 User Service

**What it does:**  
Handles everything related to **users** — signing up, logging in, managing profiles, and storing addresses.

**Think of it like:**  
The sign-up / login page of any website. Before you can buy anything, you need an account.

**Use Cases:**

| # | Use Case | Endpoint | What Happens |
|---|---|---|---|
| 1 | **Register a new user** | `POST /api/auth/register` | Takes name, email, password → hashes password with bcrypt → saves to PostgreSQL → returns JWT token |
| 2 | **Login** | `POST /api/auth/login` | Takes email + password → verifies against DB → returns access token + refresh token |
| 3 | **View profile** | `GET /api/users/:id` | Returns user name, email, address (requires valid JWT) |
| 4 | **Update profile** | `PUT /api/users/:id` | Update name, phone, or address → emits `user.profile-updated` event to Kafka |
| 5 | **Forgot password** | `POST /api/auth/forgot-password` | Sends reset link via Notification Service (Kafka event) |

**Database:** PostgreSQL  
**Why PostgreSQL?** User data is relational (user → addresses → roles) and needs strong consistency (you can't have two accounts with the same email).

**Kafka Events Produced:**
- `user.registered` — consumed by Notification Service to send welcome email
- `user.profile-updated` — consumed by Analytics

---

### 3. 📦 Order Service

**What it does:**  
Manages the **entire lifecycle of an order** — from creation to delivery (or cancellation).

**Think of it like:**  
When you click "Place Order" on Amazon, this service creates the order, tracks its status (Pending → Confirmed → Shipped → Delivered), and stores the full order history.

**Use Cases:**

| # | Use Case | Endpoint | What Happens |
|---|---|---|---|
| 1 | **Create an order** | `POST /api/orders` | Takes cart items + shipping address → creates order with status `PENDING` → emits `order.created` |
| 2 | **View an order** | `GET /api/orders/:id` | Returns order details: items, total, status, timestamps |
| 3 | **List user's orders** | `GET /api/orders?userId=abc` | Returns all orders for a user, sorted by date |
| 4 | **Cancel an order** | `PUT /api/orders/:id/cancel` | Changes status to `CANCELLED` → emits `order.cancelled` → triggers stock release + refund |
| 5 | **Order confirmed** | (Kafka consumer) | Listens for `payment.completed` + `inventory.reserved` → changes status to `CONFIRMED` |

**Database:** PostgreSQL  
**Why PostgreSQL?** Orders are financial records. You need ACID transactions — if the payment row fails to insert, the order shouldn't be created either.

**Kafka Events Produced:**
- `order.created` — tells Payment Service to charge, Inventory Service to reserve stock
- `order.confirmed` — tells Notification Service to send confirmation email
- `order.cancelled` — tells Inventory to release stock, Payment to refund

**Kafka Events Consumed:**
- `cart.checkout-initiated` — triggers order creation
- `payment.completed` / `payment.failed` — confirms or cancels the order
- `inventory.reserved` / `inventory.reservation-failed` — confirms stock availability

---

### 4. 💳 Payment Service

**What it does:**  
Processes **payments and refunds**. Integrates with external payment gateways like Stripe or Razorpay.

**Think of it like:**  
The checkout page where you enter your card details. This service talks to Stripe to actually charge your card.

**Use Cases:**

| # | Use Case | Endpoint | What Happens |
|---|---|---|---|
| 1 | **Initiate payment** | `POST /api/payments/initiate` | Takes order ID + amount → calls Stripe API → creates payment record with status `PROCESSING` |
| 2 | **Payment webhook** | `POST /api/payments/webhook` | Stripe sends a callback when payment succeeds/fails → updates payment status → emits event |
| 3 | **View payment status** | `GET /api/payments/:orderId` | Returns payment details for a given order |
| 4 | **Refund** | `POST /api/payments/:orderId/refund` | Calls Stripe refund API → emits `payment.refunded` |

**Database:** PostgreSQL  
**Why PostgreSQL?** Payment records are an append-only ledger (like a bank statement). You never delete a payment — you add a refund entry. ACID guarantees are critical.

**Kafka Events Produced:**
- `payment.completed` — tells Order Service to confirm, Notification to send receipt
- `payment.failed` — tells Order Service to cancel, Inventory to release stock
- `payment.refunded` — tells Notification to send refund confirmation

**Kafka Events Consumed:**
- `order.created` — triggers payment processing

---

### 5. 📊 Inventory Service

**What it does:**  
Tracks **stock levels** for every product. Reserves stock during checkout and releases it if the order fails.

**Think of it like:**  
A warehouse manager who keeps count of every item. When someone orders 2 shirts, the manager puts them aside (reserves). If the payment fails, they go back on the shelf (release).

**Use Cases:**

| # | Use Case | Endpoint | What Happens |
|---|---|---|---|
| 1 | **Check stock** | `GET /api/inventory/:productId` | Returns current stock count and warehouse location |
| 2 | **Reserve stock** | (Kafka consumer) | Listens for `order.created` → decrements stock using `SELECT ... FOR UPDATE` (row lock) → emits `inventory.reserved` |
| 3 | **Release stock** | (Kafka consumer) | Listens for `order.cancelled` or `payment.failed` → increments stock back → emits `inventory.released` |
| 4 | **Restock** | `PUT /api/inventory/:productId` | Admin manually adds stock (e.g., new shipment arrived) |
| 5 | **Low stock alert** | (automatic) | When stock drops below threshold → emits `inventory.low-stock` → Notification Service alerts admin |

**Database:** PostgreSQL  
**Why PostgreSQL?** Stock counts need row-level locking (`SELECT ... FOR UPDATE`). Without this, two people buying the last item simultaneously could both succeed — causing overselling.

**Kafka Events Produced:**
- `inventory.reserved` — confirms to Order Service that stock is available
- `inventory.reservation-failed` — no stock available, Order Service cancels
- `inventory.released` — stock returned after cancellation
- `inventory.low-stock` — triggers admin notification

**Kafka Events Consumed:**
- `order.created` — reserve stock
- `order.cancelled` — release stock
- `payment.failed` — release stock

---

### 6. 🔔 Notification Service

**What it does:**  
Sends **emails, SMS, and push notifications** to users. It never initiates actions — it only reacts to events from other services.

**Think of it like:**  
The messaging department. It listens for things like "order confirmed" or "payment received" and sends the appropriate message to the customer.

**Use Cases:**

| # | Use Case | Trigger Event | What Gets Sent |
|---|---|---|---|
| 1 | **Welcome email** | `user.registered` | "Welcome to our store! Here's 10% off your first order." |
| 2 | **Order confirmation** | `order.confirmed` | "Your order #ORD-123 has been confirmed! Estimated delivery: April 20." |
| 3 | **Shipping update** | `order.shipped` | "Your order is on its way! Track it here: [link]" |
| 4 | **Payment receipt** | `payment.completed` | "We received your payment of ₹1,499. Transaction ID: TXN-456." |
| 5 | **Payment failed** | `payment.failed` | "Your payment for order #ORD-123 failed. Please try again." |
| 6 | **Refund confirmation** | `payment.refunded` | "Your refund of ₹1,499 has been processed. It'll arrive in 5-7 days." |
| 7 | **Low stock alert (admin)** | `inventory.low-stock` | "[ADMIN] Product 'Blue T-Shirt (L)' has only 3 units left." |

**Database:** MongoDB  
**Why MongoDB?** Notification logs are append-only, high volume, and don't need relational structure. A TTL index automatically deletes logs older than 90 days.

**Kafka Events Consumed:**
- `user.registered`, `order.confirmed`, `order.shipped`, `payment.completed`, `payment.failed`, `payment.refunded`, `inventory.low-stock`

**Kafka Events Produced:**
- `notification.sent` — for analytics tracking
- `notification.failed` — for retry/alerting

---

### 7. 🌐 Frontend (Next.js Storefront)

**What it does:**  
The **customer-facing website** where users browse products, add items to cart, and place orders.

**Think of it like:**  
The Amazon/Flipkart website you see in your browser.

**Use Cases:**

| # | Use Case | Page/Route | What Happens |
|---|---|---|---|
| 1 | **Browse products** | `/products` | Fetches product list from API via Gateway |
| 2 | **View product details** | `/products/:id` | Shows images, price, reviews, stock availability |
| 3 | **Sign up / Login** | `/auth/register`, `/auth/login` | Calls User Service via Gateway for authentication |
| 4 | **Add to cart** | (client-side) | Manages cart state, calls Cart Service |
| 5 | **Checkout** | `/checkout` | Collects address + payment → creates order via Gateway |
| 6 | **Order history** | `/orders` | Lists past orders with status tracking |
| 7 | **Track order** | `/orders/:id` | Real-time order status (Pending → Shipped → Delivered) |

---

## How It All Connects — A Simple Example

> **Scenario:** A user places an order for 2 T-shirts.

```
Step 1:  User clicks "Place Order" on Frontend
         ↓
Step 2:  Frontend → POST /api/orders → Gateway → Order Service
         ↓
Step 3:  Order Service creates order (status: PENDING)
         → Emits "order.created" to Kafka
         ↓
Step 4:  Kafka delivers event to two services simultaneously:
         │
         ├── Inventory Service
         │   → Reserves 2 T-shirts (stock: 50 → 48)
         │   → Emits "inventory.reserved"
         │
         └── Payment Service
             → Charges ₹998 via Stripe
             → Emits "payment.completed"
         ↓
Step 5:  Order Service receives both events
         → Changes status to CONFIRMED
         → Emits "order.confirmed"
         ↓
Step 6:  Notification Service receives "order.confirmed"
         → Sends email: "Your order #ORD-789 is confirmed!"
```

### What If Payment Fails?

```
Step 4b: Payment Service → Stripe returns "card declined"
         → Emits "payment.failed"
         ↓
Step 5b: Order Service receives "payment.failed"
         → Changes status to CANCELLED
         → Emits "order.cancelled"
         ↓
Step 6b: Inventory Service receives "order.cancelled"
         → Releases 2 T-shirts (stock: 48 → 50)
         ↓
Step 7b: Notification Service receives "order.cancelled"
         → Sends email: "Your payment failed. Please try again."
```

---

## Next Steps (Phase 2)

Phase 2 will focus on implementing the actual business logic inside each service:

- [ ] User Service — register, login, JWT auth middleware
- [ ] Order Service — create order, Saga-based checkout flow
- [ ] Payment Service — Stripe integration, webhook handling
- [ ] Inventory Service — stock reservation with row locking
- [ ] Notification Service — email sending via SendGrid/SES
- [ ] Kafka producers and consumers wired up
- [ ] Database schemas and migrations

---

*Generated from the E-Commerce Platform monorepo — Phase 1 scaffolding.*
