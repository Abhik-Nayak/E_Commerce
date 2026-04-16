import { config } from '../../config';
import { logger } from '../../utils/logger';
import { getKafka, startConsumer, EventEnvelope } from '../kafka';
import * as paymentService from '../../services/payment.service';

const kafka = getKafka(config.kafka.clientId, config.kafka.brokers);

export async function startOrderConsumer(): Promise<void> {
  await startConsumer(
    kafka,
    config.kafka.groupId,
    ['ecom.order.events'],
    async (event: EventEnvelope) => {
      if (event.eventType === 'order.created') {
        const { orderId, userId, totalAmount, items } = event.payload as {
          orderId: string;
          userId: string;
          totalAmount: number;
          items: { productId: string; quantity: number }[];
        };

        logger.info({ orderId, eventType: event.eventType }, 'Processing order.created → initiating payment');

        await paymentService.initiatePayment({
          orderId,
          userId,
          amount: totalAmount,
          items,
          correlationId: event.correlationId,
        });
      }
    }
  );
  logger.info('Payment order consumer started');
}
