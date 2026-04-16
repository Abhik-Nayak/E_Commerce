import { pool } from '../db';
import { logger } from '../utils/logger';
import { config } from '../config';
import { getKafka, publishEvent, createEvent } from '../events/kafka';

const kafka = getKafka(config.kafka.clientId, config.kafka.brokers);

interface OrderItemInput {
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
}

interface CreateOrderInput {
  userId: string;
  items: OrderItemInput[];
  shippingAddress: {
    street: string;
    city: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}

export async function createOrder(input: CreateOrderInput) {
  const { userId, items, shippingAddress } = input;
  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert order
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, total_amount, shipping_address)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, status, total_amount, shipping_address, created_at`,
      [userId, totalAmount, JSON.stringify(shippingAddress)]
    );
    const order = orderResult.rows[0];

    // Insert items
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.productId, item.productName || '', item.quantity, item.unitPrice]
      );
    }

    // Insert initial status history
    await client.query(
      `INSERT INTO order_status_history (order_id, to_status) VALUES ($1, 'PENDING')`,
      [order.id]
    );

    await client.query('COMMIT');

    // Publish event
    const correlationId = undefined; // new saga starts here
    const event = createEvent(
      'order.created',
      order.id,
      'Order',
      'order-service',
      {
        orderId: order.id,
        userId,
        totalAmount,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
        shippingAddress,
      },
      correlationId
    );

    await publishEvent(kafka, 'ecom.order.events', order.id, event);
    logger.info({ orderId: order.id, totalAmount }, 'Order created and event published');

    return { ...order, items };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getOrderById(orderId: string) {
  const orderResult = await pool.query(
    `SELECT id, user_id, status, total_amount, shipping_address, created_at, updated_at FROM orders WHERE id = $1`,
    [orderId]
  );

  if (orderResult.rows.length === 0) {
    const error = new Error('Order not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  const itemsResult = await pool.query(
    `SELECT product_id, product_name, quantity, unit_price FROM order_items WHERE order_id = $1`,
    [orderId]
  );

  const historyResult = await pool.query(
    `SELECT from_status, to_status, reason, changed_at FROM order_status_history WHERE order_id = $1 ORDER BY changed_at`,
    [orderId]
  );

  return {
    ...orderResult.rows[0],
    items: itemsResult.rows,
    statusHistory: historyResult.rows,
  };
}

export async function getOrdersByUser(userId: string) {
  const result = await pool.query(
    `SELECT id, user_id, status, total_amount, created_at, updated_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function updateOrderStatus(orderId: string, newStatus: string, reason?: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query('SELECT status FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      const error = new Error('Order not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const fromStatus = current.rows[0].status;

    await client.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, orderId]
    );

    await client.query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, reason) VALUES ($1, $2, $3, $4)`,
      [orderId, fromStatus, newStatus, reason || null]
    );

    await client.query('COMMIT');

    logger.info({ orderId, fromStatus, newStatus, reason }, 'Order status updated');
    return { orderId, fromStatus, toStatus: newStatus };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function cancelOrder(orderId: string, reason?: string) {
  const order = await getOrderById(orderId);

  if (order.status === 'CANCELLED') {
    const error = new Error('Order is already cancelled') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  if (order.status === 'DELIVERED') {
    const error = new Error('Cannot cancel a delivered order') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  await updateOrderStatus(orderId, 'CANCELLED', reason || 'Cancelled by user');

  // Publish cancel event with item details so inventory can release
  await publishEvent(kafka, 'ecom.order.events', orderId, createEvent(
    'order.cancelled',
    orderId,
    'Order',
    'order-service',
    {
      orderId,
      userId: order.user_id,
      items: order.items.map((i: { product_id: string; quantity: number }) => ({
        productId: i.product_id,
        quantity: i.quantity,
      })),
      reason: reason || 'Cancelled by user',
    }
  ));

  logger.info({ orderId, reason }, 'Order cancelled');
  return { orderId, status: 'CANCELLED' };
}

export async function confirmOrder(orderId: string, correlationId: string) {
  await updateOrderStatus(orderId, 'CONFIRMED', 'Payment completed');

  const order = await getOrderById(orderId);

  await publishEvent(kafka, 'ecom.order.events', orderId, createEvent(
    'order.confirmed',
    orderId,
    'Order',
    'order-service',
    {
      orderId,
      userId: order.user_id,
      totalAmount: order.total_amount,
    },
    correlationId
  ));

  logger.info({ orderId }, 'Order confirmed');
}
