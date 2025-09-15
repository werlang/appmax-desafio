import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Create mock service instances that will be returned by constructors
const mockEmailService = {
  send: jest.fn().mockResolvedValue({
    messageId: 'test-email-id',
    preview: 'https://ethereal.email/test'
  })
};

const mockSMSService = {
  send: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'test-sms-id'
  })
};

const mockTelegramService = {
  send: jest.fn().mockResolvedValue({
    success: true,
    messageId: 123456
  })
};

// Mock ServiceRouter
const mockServiceRouter = {
  register: jest.fn()
};

// Use jest.unstable_mockModule for ES modules mocking
jest.unstable_mockModule('../services/email.js', () => ({
  default: jest.fn().mockImplementation(() => mockEmailService)
}));

jest.unstable_mockModule('../services/sms.js', () => ({
  default: jest.fn().mockImplementation(() => mockSMSService)
}));

jest.unstable_mockModule('../services/telegram.js', () => ({
  default: jest.fn().mockImplementation(() => mockTelegramService)
}));

jest.unstable_mockModule('../helpers/service-router.js', () => ({
  default: mockServiceRouter
}));

// Import the module under test after mocking
const { default: registerControllers } = await import('../controller.js');

describe('Controller Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console.log to capture service registration logs
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  describe('Service Registration', () => {
    test('should register all three services', () => {
      // Clear any previous calls
      mockServiceRouter.register.mockClear();
      
      registerControllers();
      
      expect(mockServiceRouter.register).toHaveBeenCalledTimes(3);
      expect(mockServiceRouter.register).toHaveBeenCalledWith('email', expect.any(Function));
      expect(mockServiceRouter.register).toHaveBeenCalledWith('telegram', expect.any(Function));
      expect(mockServiceRouter.register).toHaveBeenCalledWith('sms', expect.any(Function));
    });

    test('should register services in correct order', () => {
      registerControllers();
      
      const calls = mockServiceRouter.register.mock.calls;
      expect(calls[0][0]).toBe('email');
      expect(calls[1][0]).toBe('telegram');
      expect(calls[2][0]).toBe('sms');
    });

    test('should not throw errors during registration', () => {
      expect(() => registerControllers()).not.toThrow();
    });
  });

  describe('Email Service Controller', () => {
    let emailHandler;

    beforeEach(() => {
      registerControllers();
      // Get the email handler that was registered
      const emailCall = mockServiceRouter.register.mock.calls.find(call => call[0] === 'email');
      emailHandler = emailCall[1];
    });

    test('should call email service send method with correct parameters', async () => {
      const testData = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        message: 'Hello from test!'
      };

      await emailHandler(testData);

      expect(mockEmailService.send).toHaveBeenCalledWith({
        receiver: 'recipient@example.com',
        subject: 'Test Email',
        text: 'Hello from test!',
      });
    });

    test('should log email sent result', async () => {
      const testData = {
        to: 'test@example.com',
        subject: 'Test',
        message: 'Test message'
      };

      await emailHandler(testData);

      expect(console.log).toHaveBeenCalledWith('Email sent: ', {
        messageId: 'test-email-id',
        preview: 'https://ethereal.email/test'
      });
    });

    test('should return email service response', async () => {
      const testData = {
        to: 'test@example.com',
        subject: 'Test',
        message: 'Test message'
      };

      const result = await emailHandler(testData);

      expect(result).toEqual({
        messageId: 'test-email-id',
        preview: 'https://ethereal.email/test'
      });
    });

    test('should handle missing email fields', async () => {
      const testData = {
        to: 'test@example.com'
        // Missing subject and message
      };

      await emailHandler(testData);

      expect(mockEmailService.send).toHaveBeenCalledWith({
        receiver: 'test@example.com',
        subject: undefined,
        text: undefined,
      });
    });

    test('should handle null email fields', async () => {
      const testData = {
        to: null,
        subject: null,
        message: null
      };

      await emailHandler(testData);

      expect(mockEmailService.send).toHaveBeenCalledWith({
        receiver: null,
        subject: null,
        text: null,
      });
    });

    test('should handle email service errors', async () => {
      mockEmailService.send.mockRejectedValueOnce(new Error('SMTP Error'));

      const testData = {
        to: 'test@example.com',
        subject: 'Test',
        message: 'Test message'
      };

      await expect(emailHandler(testData)).rejects.toThrow('SMTP Error');
    });
  });

  describe('Telegram Service Controller', () => {
    let telegramHandler;

    beforeEach(() => {
      registerControllers();
      telegramHandler = mockServiceRouter.register.mock.calls
        .find(call => call[0] === 'telegram')[1];
    });

    test('should call telegram service send method with correct parameters', async () => {
      const testData = {
        chatId: '987654321',
        message: 'Test Telegram message'
      };

      await telegramHandler(testData);

      expect(mockTelegramService.send).toHaveBeenCalledWith({
        chatId: '987654321',
        text: 'Test Telegram message',
      });
    });

    test('should log telegram sent result', async () => {
      const testData = {
        chatId: '123456789',
        message: 'Test message'
      };

      await telegramHandler(testData);

      expect(console.log).toHaveBeenCalledWith('Telegram message sent: ', {
        success: true,
        messageId: 123456
      });
    });

    test('should return telegram service response', async () => {
      const testData = {
        chatId: '123456789',
        message: 'Test message'
      };

      const result = await telegramHandler(testData);

      expect(result).toEqual({
        success: true,
        messageId: 123456
      });
    });

    test('should handle missing telegram fields', async () => {
      const testData = {
        chatId: '123456789'
        // Missing message
      };

      await telegramHandler(testData);

      expect(mockTelegramService.send).toHaveBeenCalledWith({
        chatId: '123456789',
        text: undefined,
      });
    });

    test('should handle numeric chat ID', async () => {
      const testData = {
        chatId: 123456789,
        message: 'Test with numeric ID'
      };

      await telegramHandler(testData);

      expect(mockTelegramService.send).toHaveBeenCalledWith({
        chatId: 123456789,
        text: 'Test with numeric ID',
      });
    });

    test('should handle negative chat ID (groups)', async () => {
      const testData = {
        chatId: -123456789,
        message: 'Test group message'
      };

      await telegramHandler(testData);

      expect(mockTelegramService.send).toHaveBeenCalledWith({
        chatId: -123456789,
        text: 'Test group message',
      });
    });

    test('should handle telegram service errors', async () => {
      mockTelegramService.send.mockRejectedValueOnce(new Error('Telegram API Error'));

      const testData = {
        chatId: '123456789',
        message: 'Test message'
      };

      await expect(telegramHandler(testData)).rejects.toThrow('Telegram API Error');
    });

    test('should handle markdown formatting', async () => {
      const testData = {
        chatId: '123456789',
        message: '*Bold* _italic_ `code`'
      };

      await telegramHandler(testData);

      expect(mockTelegramService.send).toHaveBeenCalledWith({
        chatId: '123456789',
        text: '*Bold* _italic_ `code`',
      });
    });
  });

  describe('SMS Service Controller', () => {
    let smsHandler;

    beforeEach(() => {
      registerControllers();
      smsHandler = mockServiceRouter.register.mock.calls
        .find(call => call[0] === 'sms')[1];
    });

    test('should call SMS service send method with correct parameters', async () => {
      const testData = {
        to: '+1234567890',
        message: 'Hello SMS!',
        senderId: 'MyApp'
      };

      await smsHandler(testData);

      expect(mockSMSService.send).toHaveBeenCalledWith({
        to: '+1234567890',
        message: 'Hello SMS!',
        senderId: 'MyApp',
      });
    });

    test('should log SMS sent result', async () => {
      const testData = {
        to: '+5511999999999',
        message: 'Test SMS',
        senderId: 'TestApp'
      };

      await smsHandler(testData);

      expect(console.log).toHaveBeenCalledWith('SMS sent: ', {
        success: true,
        messageId: 'test-sms-id'
      });
    });

    test('should return SMS service response', async () => {
      const testData = {
        to: '+5511999999999',
        message: 'Test SMS',
        senderId: 'TestApp'
      };

      const result = await smsHandler(testData);

      expect(result).toEqual({
        success: true,
        messageId: 'test-sms-id'
      });
    });

    test('should handle missing SMS fields', async () => {
      const testData = {
        to: '+5511999999999'
        // Missing message and senderId
      };

      await smsHandler(testData);

      expect(mockSMSService.send).toHaveBeenCalledWith({
        to: '+5511999999999',
        message: undefined,
        senderId: undefined,
      });
    });

    test('should handle international phone numbers', async () => {
      const phoneNumbers = [
        '+1234567890',    // US
        '+5511999999999', // Brazil
        '+44123456789',   // UK
        '+81123456789',   // Japan
      ];

      for (const phoneNumber of phoneNumbers) {
        const testData = {
          to: phoneNumber,
          message: `Test SMS to ${phoneNumber}`,
          senderId: 'Test'
        };

        await smsHandler(testData);

        expect(mockSMSService.send).toHaveBeenCalledWith({
          to: phoneNumber,
          message: `Test SMS to ${phoneNumber}`,
          senderId: 'Test',
        });
      }
    });

    test('should handle SMS service errors', async () => {
      mockSMSService.send.mockRejectedValueOnce(new Error('SMS API Error'));

      const testData = {
        to: '+5511999999999',
        message: 'Test SMS',
        senderId: 'TestApp'
      };

      await expect(smsHandler(testData)).rejects.toThrow('SMS API Error');
    });

    test('should handle very long SMS messages', async () => {
      const longMessage = 'A'.repeat(1000);
      const testData = {
        to: '+5511999999999',
        message: longMessage,
        senderId: 'TestApp'
      };

      await smsHandler(testData);

      expect(mockSMSService.send).toHaveBeenCalledWith({
        to: '+5511999999999',
        message: longMessage,
        senderId: 'TestApp',
      });
    });
  });

  describe('Environment Variable Handling', () => {
    test('should handle missing environment variables', () => {
      const originalEmailUser = process.env.EMAIL_USER;
      const originalEmailPass = process.env.EMAIL_PASS;
      const originalTelegramToken = process.env.TELEGRAM_BOT_TOKEN;
      const originalSmsKey = process.env.SMS_API_KEY;

      delete process.env.EMAIL_USER;
      delete process.env.EMAIL_PASS;
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.SMS_API_KEY;

      registerControllers();

      const emailHandler = mockServiceRouter.register.mock.calls
        .find(call => call[0] === 'email')[1];
      const telegramHandler = mockServiceRouter.register.mock.calls
        .find(call => call[0] === 'telegram')[1];
      const smsHandler = mockServiceRouter.register.mock.calls
        .find(call => call[0] === 'sms')[1];

      // Should not throw during registration
      expect(emailHandler).toBeDefined();
      expect(telegramHandler).toBeDefined();
      expect(smsHandler).toBeDefined();

      // Restore environment variables
      process.env.EMAIL_USER = originalEmailUser;
      process.env.EMAIL_PASS = originalEmailPass;
      process.env.TELEGRAM_BOT_TOKEN = originalTelegramToken;
      process.env.SMS_API_KEY = originalSmsKey;
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle null data gracefully', async () => {
      registerControllers();
      
      const emailHandler = mockServiceRouter.register.mock.calls
        .find(call => call[0] === 'email')[1];
      const smsHandler = mockServiceRouter.register.mock.calls
        .find(call => call[0] === 'sms')[1];
      const telegramHandler = mockServiceRouter.register.mock.calls
        .find(call => call[0] === 'telegram')[1];

      await emailHandler(null);
      await smsHandler(null);
      await telegramHandler(null);

      expect(mockEmailService.send).toHaveBeenCalledWith({
        receiver: undefined,
        subject: undefined,
        text: undefined,
      });
      
      expect(mockSMSService.send).toHaveBeenCalledWith({
        to: undefined,
        message: undefined,
        senderId: undefined,
      });
      
      expect(mockTelegramService.send).toHaveBeenCalledWith({
        chatId: undefined,
        text: undefined,
      });
    });

    test('should handle undefined data gracefully', async () => {
      registerControllers();
      
      const emailHandler = mockServiceRouter.register.mock.calls
        .find(call => call[0] === 'email')[1];

      await emailHandler(undefined);

      expect(mockEmailService.send).toHaveBeenCalledWith({
        receiver: undefined,
        subject: undefined,
        text: undefined,
      });
    });

    test('should handle complex nested data objects', async () => {
      registerControllers();
      
      const emailHandler = mockServiceRouter.register.mock.calls
        .find(call => call[0] === 'email')[1];

      const complexData = {
        to: 'test@example.com',
        subject: 'Complex Test',
        message: 'Test message',
        metadata: {
          level1: {
            level2: {
              value: 'deep value'
            }
          }
        },
        extraFields: ['value1', 'value2']
      };

      await emailHandler(complexData);

      expect(mockEmailService.send).toHaveBeenCalledWith({
        receiver: 'test@example.com',
        subject: 'Complex Test',
        text: 'Test message',
      });
    });

    test('should handle all handlers throwing errors simultaneously', async () => {
      mockEmailService.send.mockRejectedValueOnce(new Error('Email error'));
      mockSMSService.send.mockRejectedValueOnce(new Error('SMS error'));
      mockTelegramService.send.mockRejectedValueOnce(new Error('Telegram error'));

      registerControllers();
      
      const emailHandler = mockServiceRouter.register.mock.calls
        .find(call => call[0] === 'email')[1];
      const smsHandler = mockServiceRouter.register.mock.calls
        .find(call => call[0] === 'sms')[1];
      const telegramHandler = mockServiceRouter.register.mock.calls
        .find(call => call[0] === 'telegram')[1];

      await expect(emailHandler({ to: 'test@example.com' })).rejects.toThrow('Email error');
      await expect(smsHandler({ to: '+5511999999999' })).rejects.toThrow('SMS error');
      await expect(telegramHandler({ chatId: '123456789' })).rejects.toThrow('Telegram error');
    });
  });

  describe('Controller Integration', () => {
    test('should work with actual ServiceRouter flow', async () => {
      registerControllers();

      const registeredHandlers = {};
      mockServiceRouter.register.mock.calls.forEach(([name, handler]) => {
        registeredHandlers[name] = handler;
      });

      expect(registeredHandlers).toHaveProperty('email');
      expect(registeredHandlers).toHaveProperty('sms');
      expect(registeredHandlers).toHaveProperty('telegram');
      expect(typeof registeredHandlers.email).toBe('function');
      expect(typeof registeredHandlers.sms).toBe('function');
      expect(typeof registeredHandlers.telegram).toBe('function');
    });

    test('should handle multiple registrations', () => {
      // Register multiple times to ensure no conflicts
      registerControllers();
      registerControllers();
      registerControllers();

      // Should register services multiple times without errors
      expect(mockServiceRouter.register).toHaveBeenCalledTimes(9); // 3 services × 3 calls
    });
  });
});