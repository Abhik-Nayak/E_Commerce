# Phase 2 — Core Services Complete

We have fully implemented the business logic for all microservices. The backend is now a **fully functional, event-driven ecosystem** capable of handling distributed transactions via the Saga pattern.

## What Was accomplished?

### 1. Local Infrastructure (Docker)
- Added `docker-compose.yml` to spin up **PostgreSQL 16**, **MongoDB 7**, **Apache Kafka (KRaft)**, and **Kafka UI**.
- Postgres auto-initialises 4 databases on startup (`users_db`, `orders_db`, `payments_db`, `inventory_db`).

### 2. Distributed Events (Kafka)
- Created a shared `kafka.ts` helper with strongly-typed `EventEnvelope`.
- Connected all services to Kafka on `localhost:9092`.

### 3. Service Implementations

**User Service (Port 4005)**
- Full JWT Authentication (register, login, auth middleware).
- PostgreSQL `users` and `addresses` tables.

**Inventory Service (Port 4003)**
- Stock reservation with robust **row-level locking** (`SELECT ... FOR UPDATE`).
- Auto-seeds 8 sample products into the database on startup.
- Kafka Consumers: Listens to order/payment events to reserve or release stock.

**Payment Service (Port 4002)**
- Mock payment gateway simulating Stripe (80% success, 20% failure, 1s delay).
- Kafka Consumers: Automatically charges the user when `order.created` is received.

**Order Service (Port 4001)**
- Central orchestrator of the **Checkout Saga**.
- Creates pending orders, waits for payment and inventory events via Kafka, then transitions to `CONFIRMED` or `CANCELLED`.

**Notification Service (Port 4004)**
- MongoDB persistence with a 90-day TTL (auto-deletes old logs).
- Consumes **all events** (`order.*`, `payment.*`, `user.*`, `inventory.*`) and matches them to messaging templates.

---

## The Checkout Saga Flow

When a user places an order, the system relies on choreography (events) rather than synchronous API calls:

1. **Order Service** creates a `PENDING` order. Emits `order.created`.
2. **Kafka** delivers the event to:
   - **Payment Service**: Charges the total amount. Emits `payment.completed` or `payment.failed`.
   - **Inventory Service**: Locks the database, decrements stock. Emits `inventory.reserved` or `inventory.reservation-failed`.
3. **Order Service** listens to the outcomes:
   - If payment & inventory succeed → Updates to `CONFIRMED`.
   - If payment or inventory fail → Updates to `CANCELLED` and emits `order.cancelled`.
4. **Inventory Service** listens to `order.cancelled` and releases stock back to available.
5. **Notification Service** listens to all steps and generates email logs to MongoDB.

---

## How to Test End-To-End

Since Docker Hub might be slow fetching the images initially, wait for `docker compose up -d` to finish inside the terminal.

Once Docker is running, you can test the system:

### 1. Start all Node.js Services
Run the helper script from the root folder:
```powershell
.\run-all.ps1
```
*(Or manually run `npm run dev:xxx` for each service.)*

### 2. Create a User (Registration)
```bash
curl -X POST http://localhost:4000/api/auth/register \
-H "Content-Type: application/json" \
-d '{"name":"Test User", "email":"test@example.com", "password":"password123"}'
```
*Note: Save the `accessToken` returned!*

### 3. Check Inventory for a Product
```bash
curl http://localhost:4000/api/inventory/prod-001
```

### 4. Place an Order
Use the Gateway port (4000) and pass the JWT token.
```bash
curl -X POST http://localhost:4000/api/orders \
-H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
-H "Content-Type: application/json" \
-d '{"userId":"<put-user-id-here>", "items":[{"productId":"prod-001", "quantity":2, "unitPrice":499}], "shippingAddress":{"street":"123 Main St", "city":"Mumbai"}}'
```

### 5. Check Order Status
The order starts as `PENDING`. After ~1.5 seconds, Kafka processes the payment and inventory.
Request the order details again:
```bash
curl http://localhost:4000/api/orders/<put-order-id-here>
```
You will see the `status` changed to `CONFIRMED` or `CANCELLED` (due to the 20% mock failure rate).

Check out **Kafka UI** at `http://localhost:8080` to see all the events flying between the microservices!
