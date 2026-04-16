import { pool } from '../db';
import { logger } from '../utils/logger';
import { config } from '../config';
import { getKafka, publishEvent, createEvent } from '../events/kafka';

const kafka = getKafka(config.kafka.clientId, config.kafka.brokers);

interface UpdateUserInput {
  name?: string;
  phone?: string;
}

export async function getUserById(id: string) {
  const userResult = await pool.query(
    'SELECT id, name, email, phone, created_at, updated_at FROM users WHERE id = $1',
    [id]
  );

  if (userResult.rows.length === 0) {
    const error = new Error('User not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  const addressResult = await pool.query(
    'SELECT id, street, city, state, zip, country, is_default FROM addresses WHERE user_id = $1',
    [id]
  );

  return {
    ...userResult.rows[0],
    addresses: addressResult.rows,
  };
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.name) {
    fields.push(`name = $${idx++}`);
    values.push(input.name);
  }
  if (input.phone) {
    fields.push(`phone = $${idx++}`);
    values.push(input.phone);
  }

  if (fields.length === 0) {
    const error = new Error('No fields to update') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, email, phone, updated_at`,
    values
  );

  if (result.rows.length === 0) {
    const error = new Error('User not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  const user = result.rows[0];

  publishEvent(kafka, 'ecom.user.events', user.id, createEvent(
    'user.profile-updated',
    user.id,
    'User',
    'user-service',
    { userId: user.id, name: user.name, email: user.email }
  )).catch(err => logger.error({ err }, 'Failed to publish user.profile-updated event'));

  return user;
}
