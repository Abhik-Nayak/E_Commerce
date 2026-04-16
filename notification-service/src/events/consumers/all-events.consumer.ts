import { config } from '../../config';
import { logger } from '../../utils/logger';
import { getKafka, startConsumer, EventEnvelope } from '../kafka';
import { processNotification } from '../../services/notification.service';

const kafka = getKafka(config.kafka.clientId, config.kafka.brokers);

export async function startAllConsumers(): Promise<void> {
  const topics = [
    'ecom.user.events',
    'ecom.order.events',
    'ecom.payment.events',
    'ecom.inventory.events',
  ];

  await startConsumer(
    kafka,
    config.kafka.groupId,
    topics,
    async (event: EventEnvelope) => {
      logger.debug({ eventType: event.eventType, aggregateId: event.aggregateId }, 'Received event');
      await processNotification(event.eventType, event.payload as Record<string, unknown>);
    }
  );

  logger.info({ topics }, 'Notification consumers started for all topics');
}
