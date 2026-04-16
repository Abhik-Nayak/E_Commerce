import { config } from '../../config';
import { logger } from '../../utils/logger';
import { getKafka, startConsumer, EventEnvelope } from '../kafka';
import * as orderService from '../../services/order.service';

const kafka = getKafka(config.kafka.clientId, config.kafka.brokers);

export async function startInventoryConsumer(): Promise<void> {
  await startConsumer(
    kafka,
    `${config.kafka.groupId}-inventory`,
    ['ecom.inventory.events'],
    async (event: EventEnvelope) => {
      switch (event.eventType) {
        case 'inventory.reserved': {
          const { orderId } = event.payload as { orderId: string };
          logger.info({ orderId, eventType: event.eventType }, 'Stock reserved for order');
          // In a full Saga, we'd track that inventory step is done.
          // For now, the order confirmation is driven by payment.completed.
          break;
        }

        case 'inventory.reservation-failed': {
          const { orderId, reason } = event.payload as { orderId: string; reason: string };
          logger.info({ orderId, eventType: event.eventType }, 'Stock reservation failed → cancelling order');
          await orderService.cancelOrder(orderId, `Inventory: ${reason}`);
          break;
        }

        default:
          break;
      }
    }
  );
  logger.info('Order inventory consumer started');
}
