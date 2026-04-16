import { config } from '../../config';
import { logger } from '../../utils/logger';
import { getKafka, startConsumer, EventEnvelope } from '../kafka';
import * as orderService from '../../services/order.service';

const kafka = getKafka(config.kafka.clientId, config.kafka.brokers);

export async function startPaymentConsumer(): Promise<void> {
  await startConsumer(
    kafka,
    config.kafka.groupId,
    ['ecom.payment.events'],
    async (event: EventEnvelope) => {
      switch (event.eventType) {
        case 'payment.completed': {
          const { orderId } = event.payload as { orderId: string };
          logger.info({ orderId, eventType: event.eventType }, 'Processing payment.completed → confirming order');
          await orderService.confirmOrder(orderId, event.correlationId);
          break;
        }

        case 'payment.failed': {
          const { orderId, reason } = event.payload as { orderId: string; reason: string };
          logger.info({ orderId, eventType: event.eventType }, 'Processing payment.failed → cancelling order');
          await orderService.cancelOrder(orderId, `Payment failed: ${reason}`);
          break;
        }

        default:
          break;
      }
    }
  );
  logger.info('Order payment consumer started');
}
