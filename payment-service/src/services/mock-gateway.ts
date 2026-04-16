import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

interface PaymentResult {
  success: boolean;
  transactionId: string;
  failureReason?: string;
}

/**
 * Mock payment gateway — simulates Stripe/Razorpay processing.
 * 80% success rate, 20% failure rate, with a 1-second simulated delay.
 */
export async function processPayment(
  amount: number,
  _currency: string
): Promise<PaymentResult> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 1000));

  const transactionId = `txn_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const isSuccess = Math.random() < 0.8;

  if (isSuccess) {
    logger.info({ transactionId, amount }, 'Mock gateway: payment APPROVED');
    return { success: true, transactionId };
  } else {
    const reasons = [
      'Card declined',
      'Insufficient funds',
      'Card expired',
      'Processing error',
    ];
    const failureReason = reasons[Math.floor(Math.random() * reasons.length)];
    logger.warn({ transactionId, amount, failureReason }, 'Mock gateway: payment DECLINED');
    return { success: false, transactionId, failureReason };
  }
}

/**
 * Mock refund — always succeeds.
 */
export async function processRefund(
  _originalTransactionId: string,
  amount: number
): Promise<{ success: boolean; refundId: string }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const refundId = `ref_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  logger.info({ refundId, amount }, 'Mock gateway: refund processed');
  return { success: true, refundId };
}
