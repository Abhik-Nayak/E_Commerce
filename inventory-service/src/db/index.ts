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
      CREATE TABLE IF NOT EXISTS inventory (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id          VARCHAR(100) UNIQUE NOT NULL,
        product_name        VARCHAR(500) NOT NULL,
        quantity            INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
        reserved            INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
        warehouse           VARCHAR(100) DEFAULT 'MAIN',
        low_stock_threshold INTEGER DEFAULT 10,
        updated_at          TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reservation_log (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id  VARCHAR(100) NOT NULL,
        order_id    VARCHAR(100) NOT NULL,
        quantity    INTEGER NOT NULL,
        action      VARCHAR(20) NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
      CREATE INDEX IF NOT EXISTS idx_reservation_order ON reservation_log(order_id);
    `);
    logger.info('Inventory tables initialised');
  } finally {
    client.release();
  }
}

export async function seedInventory(): Promise<void> {
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT COUNT(*) FROM inventory');
    if (parseInt(existing.rows[0].count) > 0) return;

    await client.query(`
      INSERT INTO inventory (product_id, product_name, quantity, low_stock_threshold) VALUES
        ('prod-001', 'Classic Blue T-Shirt (M)', 100, 10),
        ('prod-002', 'Classic Blue T-Shirt (L)', 75, 10),
        ('prod-003', 'Slim Fit Jeans (32)', 50, 5),
        ('prod-004', 'Wireless Earbuds Pro', 200, 20),
        ('prod-005', 'Leather Wallet (Brown)', 150, 15),
        ('prod-006', 'Running Shoes (Size 10)', 60, 8),
        ('prod-007', 'Stainless Steel Water Bottle', 300, 30),
        ('prod-008', 'Laptop Backpack', 80, 10)
      ON CONFLICT (product_id) DO NOTHING;
    `);
    logger.info('Inventory seeded with sample products');
  } finally {
    client.release();
  }
}
