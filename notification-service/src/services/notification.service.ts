import { logger } from '../utils/logger';
import { Notification } from '../models/notification.model';

interface NotificationTemplate {
  subject: string;
  body: string;
}

type TemplatePayload = Record<string, unknown>;

const templates: Record<string, (data: TemplatePayload) => NotificationTemplate> = {
  'user.registered': (data) => ({
    subject: 'Welcome to E-Commerce Platform! 🎉',
    body: `Hi ${data.name}! Welcome to our store. Start shopping and enjoy great deals!`,
  }),

  'order.created': (data) => ({
    subject: `Order #${(data.orderId as string).slice(0, 8)} — Processing`,
    body: `Your order has been placed and is being processed. Total: ₹${data.totalAmount}`,
  }),

  'order.confirmed': (data) => ({
    subject: `Order #${(data.orderId as string).slice(0, 8)} — Confirmed ✅`,
    body: `Great news! Your order has been confirmed. We're preparing it for shipment.`,
  }),

  'order.cancelled': (data) => ({
    subject: `Order #${(data.orderId as string).slice(0, 8)} — Cancelled`,
    body: `Your order has been cancelled. Reason: ${data.reason || 'Not specified'}. If you were charged, a refund will be processed.`,
  }),

  'payment.completed': (data) => ({
    subject: `Payment Received — ₹${data.amount}`,
    body: `We received your payment of ₹${data.amount}. Transaction ID: ${data.transactionId}`,
  }),

  'payment.failed': (data) => ({
    subject: `Payment Failed ❌`,
    body: `Your payment of ₹${data.amount} failed. Reason: ${data.reason}. Please try again.`,
  }),

  'payment.refunded': (data) => ({
    subject: `Refund Processed — ₹${data.amount}`,
    body: `Your refund of ₹${data.amount} has been processed. Refund ID: ${data.refundId}. It should arrive in 5-7 business days.`,
  }),

  'inventory.low-stock': (data) => ({
    subject: `⚠️ Low Stock Alert: ${data.productName}`,
    body: `Product "${data.productName}" (${data.productId}) has only ${data.available} units left (threshold: ${data.threshold}).`,
  }),

  'inventory.reserved': (data) => ({
    subject: `Stock Reserved for Order #${(data.orderId as string).slice(0, 8)}`,
    body: `Stock has been reserved for your order.`,
  }),
};

export async function processNotification(
  eventType: string,
  payload: TemplatePayload
): Promise<void> {
  const templateFn = templates[eventType];

  if (!templateFn) {
    logger.debug({ eventType }, 'No notification template for event type, skipping');
    return;
  }

  const userId = (payload.userId as string) || 'system';
  const template = templateFn(payload);

  // Log to console (simulates sending email/SMS)
  logger.info({
    eventType,
    userId,
    subject: template.subject,
  }, `📧 NOTIFICATION: ${template.subject}`);

  console.log('\n' + '─'.repeat(60));
  console.log(`📧  TO: User ${userId}`);
  console.log(`📋  SUBJECT: ${template.subject}`);
  console.log(`📝  BODY: ${template.body}`);
  console.log('─'.repeat(60) + '\n');

  // Save to MongoDB
  try {
    await Notification.create({
      userId,
      type: eventType,
      channel: 'email',
      subject: template.subject,
      body: template.body,
      status: 'SENT',
      metadata: payload,
    });
  } catch (err) {
    logger.error({ err, eventType, userId }, 'Failed to save notification to DB');
  }
}
