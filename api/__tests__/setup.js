import { jest } from '@jest/globals';

// Global test setup
global.console = {
  ...console,
  // Suppress console.log during tests unless specifically testing it
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.EMAIL_USER = 'test@example.com';
process.env.EMAIL_PASS = 'testpass';
process.env.TELEGRAM_BOT_TOKEN = 'test_token';
process.env.SMS_API_KEY = 'test_sms_key';

// Mock fetch globally for all tests
global.fetch = jest.fn();

// Mock Redis for tests
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    quit: jest.fn(),
    zadd: jest.fn(),
    zrangebyscore: jest.fn(),
    zrem: jest.fn(),
  }));
});

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTestAccount: jest.fn(() => Promise.resolve({
    user: 'test@ethereal.email',
    pass: 'testpass123'
  })),
  createTransporter: jest.fn(() => ({
    sendMail: jest.fn(() => Promise.resolve({
      messageId: 'test-message-id',
      response: '250 OK'
    })),
    close: jest.fn()
  })),
  getTestMessageUrl: jest.fn(() => 'https://ethereal.email/message/test')
}));

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});