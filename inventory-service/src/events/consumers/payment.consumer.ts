import { config } from '../../config';
import { logger } from '../../utils/logger';
import { getKafka, startConsumer, EventEnvelope } from '../kafka';
import * as inventoryService from '../../services/inventory.service';

const kafka = getKafka(config.kafka.clientId, config.kafka.brokers);

export async function startPaymentConsumer(): Promise<void> {
  await startConsumer(
    kafka,
    `${config.kafka.groupId}-payment`,
    ['ecom.payment.events'],
    async (event: EventEnvelope) => {
      if (event.eventType === 'payment.failed') {
        const { orderId, items } = event.payload as {
          orderId: string;
          items: { productId: string; quantity: number }[];
        };
        logger.info({ orderId, eventType: event.eventType }, 'Processing payment.failed → releasing stock');
        await inventoryService.releaseStock(items, orderId, event.correlationId);
      }
    }
  );
  logger.info('Inventory payment consumer started');
}
