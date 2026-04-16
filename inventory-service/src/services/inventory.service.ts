import { pool } from '../db';
import { logger } from '../utils/logger';
import { config } from '../config';
import { getKafka, publishEvent, createEvent } from '../events/kafka';

const kafka = getKafka(config.kafka.clientId, config.kafka.brokers);

export async function getStock(productId: string) {
  const result = await pool.query(
    'SELECT product_id, product_name, quantity, reserved, (quantity - reserved) AS available, warehouse FROM inventory WHERE product_id = $1',
    [productId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Product not found in inventory') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

export async function getAllStock() {
  const result = await pool.query(
    'SELECT product_id, product_name, quantity, reserved, (quantity - reserved) AS available, warehouse FROM inventory ORDER BY product_name'
  );
  return result.rows;
}

export async function reserveStock(
  items: { productId: string; quantity: number }[],
  orderId: string,
  correlationId: string
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const item of items) {
      // Row-level lock to prevent overselling
      const result = await client.query(
        'SELECT quantity, reserved, product_name FROM inventory WHERE product_id = $1 FOR UPDATE',
        [item.productId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        logger.warn({ productId: item.productId, orderId }, 'Product not found during reservation');

        await publishEvent(kafka, 'ecom.inventory.events', orderId, createEvent(
          'inventory.reservation-failed',
          orderId,
          'Inventory',
          'inventory-service',
          { orderId, reason: `Product ${item.productId} not found`, items },
          correlationId
        ));
        return false;
      }

      const { quantity, reserved } = result.rows[0];
      const available = quantity - reserved;

      if (available < item.quantity) {
        await client.query('ROLLBACK');
        logger.warn({ productId: item.productId, requested: item.quantity, available, orderId }, 'Insufficient stock');

        await publishEvent(kafka, 'ecom.inventory.events', orderId, createEvent(
          'inventory.reservation-failed',
          orderId,
          'Inventory',
          'inventory-service',
          { orderId, reason: `Insufficient stock for ${item.productId}. Available: ${available}, Requested: ${item.quantity}`, items },
          correlationId
        ));
        return false;
      }

      // Reserve the stock
      await client.query(
        'UPDATE inventory SET reserved = reserved + $1, updated_at = NOW() WHERE product_id = $2',
        [item.quantity, item.productId]
      );

      // Log the reservation
      await client.query(
        'INSERT INTO reservation_log (product_id, order_id, quantity, action) VALUES ($1, $2, $3, $4)',
        [item.productId, orderId, item.quantity, 'RESERVE']
      );

      // Check low stock
      const updated = await client.query(
        'SELECT quantity, reserved, low_stock_threshold, product_name FROM inventory WHERE product_id = $1',
        [item.productId]
      );
      const row = updated.rows[0];
      if ((row.quantity - row.reserved) <= row.low_stock_threshold) {
        publishEvent(kafka, 'ecom.inventory.events', item.productId, createEvent(
          'inventory.low-stock',
          item.productId,
          'Inventory',
          'inventory-service',
          { productId: item.productId, productName: row.product_name, available: row.quantity - row.reserved, threshold: row.low_stock_threshold },
          correlationId
        )).catch(err => logger.error({ err }, 'Failed to publish low-stock event'));
      }
    }

    await client.query('COMMIT');

    // Publish success event
    await publishEvent(kafka, 'ecom.inventory.events', orderId, createEvent(
      'inventory.reserved',
      orderId,
      'Inventory',
      'inventory-service',
      { orderId, items },
      correlationId
    ));

    logger.info({ orderId, items }, 'Stock reserved successfully');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err, orderId }, 'Failed to reserve stock');
    throw err;
  } finally {
    client.release();
  }
}

export async function releaseStock(
  items: { productId: string; quantity: number }[],
  orderId: string,
  correlationId: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const item of items) {
      await client.query(
        'UPDATE inventory SET reserved = GREATEST(reserved - $1, 0), updated_at = NOW() WHERE product_id = $2',
        [item.quantity, item.productId]
      );

      await client.query(
        'INSERT INTO reservation_log (product_id, order_id, quantity, action) VALUES ($1, $2, $3, $4)',
        [item.productId, orderId, item.quantity, 'RELEASE']
      );
    }

    await client.query('COMMIT');

    await publishEvent(kafka, 'ecom.inventory.events', orderId, createEvent(
      'inventory.released',
      orderId,
      'Inventory',
      'inventory-service',
      { orderId, items },
      correlationId
    ));

    logger.info({ orderId, items }, 'Stock released successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err, orderId }, 'Failed to release stock');
    throw err;
  } finally {
    client.release();
  }
}

export async function adminRestock(productId: string, quantity: number) {
  const result = await pool.query(
    'UPDATE inventory SET quantity = quantity + $1, updated_at = NOW() WHERE product_id = $2 RETURNING product_id, product_name, quantity, reserved, (quantity - reserved) AS available',
    [quantity, productId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Product not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  logger.info({ productId, added: quantity, newTotal: result.rows[0].quantity }, 'Admin restocked product');
  return result.rows[0];
}
