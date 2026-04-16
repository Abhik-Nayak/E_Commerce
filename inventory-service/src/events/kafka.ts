import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import { randomUUID } from 'crypto';

// ─── Event Envelope ─────────────────────────────────
export interface EventEnvelope<T = unknown> {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  timestamp: string;
  version: number;
  source: string;
  correlationId: string;
  payload: T;
}

export function createEvent<T>(
  eventType: string,
  aggregateId: string,
  aggregateType: string,
  source: string,
  payload: T,
  correlationId?: string
): EventEnvelope<T> {
  return {
    eventId: randomUUID(),
    eventType,
    aggregateId,
    aggregateType,
    timestamp: new Date().toISOString(),
    version: 1,
    source,
    correlationId: correlationId || randomUUID(),
    payload,
  };
}

// ─── Kafka Client ───────────────────────────────────
let kafka: Kafka | null = null;
let producer: Producer | null = null;

export function getKafka(clientId: string, brokers: string[]): Kafka {
  if (!kafka) {
    kafka = new Kafka({ clientId, brokers });
  }
  return kafka;
}

// ─── Producer ───────────────────────────────────────
export async function connectProducer(k: Kafka): Promise<Producer> {
  if (!producer) {
    producer = k.producer();
    await producer.connect();
  }
  return producer;
}

export async function publishEvent(
  k: Kafka,
  topic: string,
  key: string,
  event: EventEnvelope
): Promise<void> {
  const p = await connectProducer(k);
  await p.send({
    topic,
    messages: [{ key, value: JSON.stringify(event) }],
  });
}

// ─── Consumer ───────────────────────────────────────
export type EventHandler = (event: EventEnvelope) => Promise<void>;

export async function startConsumer(
  k: Kafka,
  groupId: string,
  topics: string[],
  handler: EventHandler
): Promise<Consumer> {
  const consumer = k.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topics, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }: EachMessagePayload) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString()) as EventEnvelope;
      await handler(event);
    },
  });
  return consumer;
}
