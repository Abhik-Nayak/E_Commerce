import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { config } from '../config';
import { logger } from '../utils/logger';
import { getKafka, publishEvent, createEvent } from '../events/kafka';

const kafka = getKafka(config.kafka.clientId, config.kafka.brokers);

interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthResult {
  user: { id: string; name: string; email: string };
  accessToken: string;
  refreshToken: string;
}

function generateTokens(userId: string, email: string) {
  const accessToken = jwt.sign(
    { userId, email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as any }
  );
  const refreshToken = jwt.sign(
    { userId, email, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn as any }
  );
  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const { name, email, password } = input;

  // Check if user exists
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    const error = new Error('Email already registered') as Error & { statusCode: number };
    error.statusCode = 409;
    throw error;
  }

  // Hash password & insert
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
    [name, email, passwordHash]
  );

  const user = result.rows[0];
  const tokens = generateTokens(user.id, user.email);

  // Publish event (fire-and-forget, don't block auth)
  publishEvent(kafka, 'ecom.user.events', user.id, createEvent(
    'user.registered',
    user.id,
    'User',
    'user-service',
    { userId: user.id, name: user.name, email: user.email }
  )).catch(err => logger.error({ err }, 'Failed to publish user.registered event'));

  return { user, ...tokens };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const { email, password } = input;

  const result = await pool.query(
    'SELECT id, name, email, password_hash FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    const error = new Error('Invalid email or password') as Error & { statusCode: number };
    error.statusCode = 401;
    throw error;
  }

  const user = result.rows[0];
  const isValid = await bcrypt.compare(password, user.password_hash);

  if (!isValid) {
    const error = new Error('Invalid email or password') as Error & { statusCode: number };
    error.statusCode = 401;
    throw error;
  }

  const tokens = generateTokens(user.id, user.email);
  return {
    user: { id: user.id, name: user.name, email: user.email },
    ...tokens,
  };
}
