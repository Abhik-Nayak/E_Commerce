import { pool } from '../db';
import { logger } from '../utils/logger';
import { config } from '../config';
import { getKafka, publishEvent, createEvent } from '../events/kafka';
import * as mockGateway from './mock-gateway';

const kafka = getKafka(config.kafka.clientId, config.kafka.brokers);

interface InitiatePaymentInput {
  orderId: string;
  userId: string;
  amount: number;
  items: { productId: string; quantity: number }[];
  correlationId: string;
}

export async function initiatePayment(input: InitiatePaymentInput) {
  const { orderId, userId, amount, items, correlationId } = input;

  // Create payment record
  const result = await pool.query(
    `INSERT INTO payments (order_id, user_id, amount, status)
     VALUES ($1, $2, $3, 'PROCESSING')
     RETURNING id, order_id, user_id, amount, status, created_at`,
    [orderId, userId, amount]
  );
  const payment = result.rows[0];
  logger.info({ paymentId: payment.id, orderId, amount }, 'Payment initiated');

  // Process via mock gateway
  const gatewayResult = await mockGateway.processPayment(amount, 'INR');

  if (gatewayResult.success) {
    await pool.query(
      `UPDATE payments SET status = 'COMPLETED', gateway_ref = $1, updated_at = NOW() WHERE id = $2`,
      [gatewayResult.transactionId, payment.id]
    );

    await publishEvent(kafka, 'ecom.payment.events', orderId, createEvent(
      'payment.completed',
      orderId,
      'Payment',
      'payment-service',
      { orderId, userId, amount, transactionId: gatewayResult.transactionId, paymentId: payment.id },
      correlationId
    ));

    logger.info({ paymentId: payment.id, orderId }, 'Payment completed');
  } else {
    await pool.query(
      `UPDATE payments SET status = 'FAILED', gateway_ref = $1, failure_reason = $2, updated_at = NOW() WHERE id = $3`,
      [gatewayResult.transactionId, gatewayResult.failureReason, payment.id]
    );

    await publishEvent(kafka, 'ecom.payment.events', orderId, createEvent(
      'payment.failed',
      orderId,
      'Payment',
      'payment-service',
      { orderId, userId, amount, reason: gatewayResult.failureReason, paymentId: payment.id, items },
      correlationId
    ));

    logger.warn({ paymentId: payment.id, orderId, reason: gatewayResult.failureReason }, 'Payment failed');
  }

  return { ...payment, status: gatewayResult.success ? 'COMPLETED' : 'FAILED' };
}

export async function getPaymentByOrderId(orderId: string) {
  const result = await pool.query(
    'SELECT id, order_id, user_id, amount, currency, status, gateway_ref, failure_reason, created_at, updated_at FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
    [orderId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Payment not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

export async function refundPayment(orderId: string, correlationId?: string) {
  const payment = await getPaymentByOrderId(orderId);

  if (payment.status !== 'COMPLETED') {
    const error = new Error('Can only refund completed payments') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  const refundResult = await mockGateway.processRefund(payment.gateway_ref, payment.amount);

  await pool.query(
    `UPDATE payments SET status = 'REFUNDED', updated_at = NOW() WHERE id = $1`,
    [payment.id]
  );

  await publishEvent(kafka, 'ecom.payment.events', orderId, createEvent(
    'payment.refunded',
    orderId,
    'Payment',
    'payment-service',
    { orderId, userId: payment.user_id, amount: payment.amount, refundId: refundResult.refundId },
    correlationId || ''
  ));

  logger.info({ orderId, refundId: refundResult.refundId }, 'Payment refunded');
  return { ...payment, status: 'REFUNDED', refundId: refundResult.refundId };
}
