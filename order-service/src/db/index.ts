import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

export const pool = new Pool({
  connectionString: config.database.url,
});

export async function initDB(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE order_status AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;

      CREATE TABLE IF NOT EXISTS orders (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id           VARCHAR(100) NOT NULL,
        status            order_status DEFAULT 'PENDING',
        total_amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
        shipping_address  JSONB,
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id    VARCHAR(100) NOT NULL,
        product_name  VARCHAR(500) DEFAULT '',
        quantity      INTEGER NOT NULL CHECK (quantity > 0),
        unit_price    DECIMAL(12,2) NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS order_status_history (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        from_status VARCHAR(20),
        to_status   VARCHAR(20) NOT NULL,
        reason      VARCHAR(500),
        changed_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_status_history(order_id);
    `);
    logger.info('Order tables initialised');
  } finally {
    client.release();
  }
}
