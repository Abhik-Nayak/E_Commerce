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
      CREATE TYPE payment_status AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED');

      CREATE TABLE IF NOT EXISTS payments (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id      VARCHAR(100) NOT NULL,
        user_id       VARCHAR(100) NOT NULL,
        amount        DECIMAL(12,2) NOT NULL,
        currency      VARCHAR(3) DEFAULT 'INR',
        status        payment_status DEFAULT 'PROCESSING',
        gateway_ref   VARCHAR(200),
        failure_reason VARCHAR(500),
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
      CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
    `);
    logger.info('Payment tables initialised');
  } catch (err: unknown) {
    // Ignore "type already exists" error
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === '42710') {
      logger.debug('payment_status type already exists, skipping');
      // Still create table
      await client.query(`
        CREATE TABLE IF NOT EXISTS payments (
          id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id      VARCHAR(100) NOT NULL,
          user_id       VARCHAR(100) NOT NULL,
          amount        DECIMAL(12,2) NOT NULL,
          currency      VARCHAR(3) DEFAULT 'INR',
          status        payment_status DEFAULT 'PROCESSING',
          gateway_ref   VARCHAR(200),
          failure_reason VARCHAR(500),
          created_at    TIMESTAMPTZ DEFAULT NOW(),
          updated_at    TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
        CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
      `);
      logger.info('Payment tables initialised');
    } else {
      throw err;
    }
  } finally {
    client.release();
  }
}
