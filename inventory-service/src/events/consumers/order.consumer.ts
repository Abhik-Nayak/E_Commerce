import { config } from '../../config';
import { logger } from '../../utils/logger';
import { getKafka, startConsumer, EventEnvelope } from '../kafka';
import * as inventoryService from '../../services/inventory.service';

const kafka = getKafka(config.kafka.clientId, config.kafka.brokers);

export async function startOrderConsumer(): Promise<void> {
  await startConsumer(
    kafka,
    config.kafka.groupId,
    ['ecom.order.events'],
    async (event: EventEnvelope) => {
      switch (event.eventType) {
        case 'order.created': {
          const { orderId, items } = event.payload as {
            orderId: string;
            items: { productId: string; quantity: number }[];
          };
          logger.info({ orderId, eventType: event.eventType }, 'Processing order.created → reserving stock');
          await inventoryService.reserveStock(items, orderId, event.correlationId);
          break;
        }

        case 'order.cancelled': {
          const { orderId, items } = event.payload as {
            orderId: string;
            items: { productId: string; quantity: number }[];
          };
          logger.info({ orderId, eventType: event.eventType }, 'Processing order.cancelled → releasing stock');
          await inventoryService.releaseStock(items, orderId, event.correlationId);
          break;
        }

        default:
          break;
      }
    }
  );
  logger.info('Inventory order consumer started');
}
