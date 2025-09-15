import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock nodemailer before importing EmailService
const mockTransporter = {
  sendMail: jest.fn(),
  close: jest.fn()
};

const mockNodemailer = {
  createTransport: jest.fn(() => mockTransporter),
  createTestAccount: jest.fn(() => Promise.resolve({
    user: 'test@ethereal.email',
    pass: 'testpass123'
  })),
  getTestMessageUrl: jest.fn(() => 'https://ethereal.email/test-url')
};

jest.unstable_mockModule('nodemailer', () => ({
  default: mockNodemailer
}));

// Import EmailService after mocking
const { default: EmailService } = await import('../services/email.js');

// Reset mocks for each test
beforeEach(() => {
  jest.clearAllMocks();
  // Reset mock implementations
  mockNodemailer.createTestAccount.mockResolvedValue({
    user: 'test@ethereal.email',
    pass: 'testpass123'
  });
  mockNodemailer.createTransport.mockReturnValue(mockTransporter);
  mockNodemailer.getTestMessageUrl.mockReturnValue('https://ethereal.email/test-url');
  mockTransporter.sendMail.mockResolvedValue({
    messageId: 'test-message-id',
    envelope: { to: ['test@example.com'] }
  });
});

describe('EmailService', () => {
  describe('Constructor', () => {
    test('should create instance with valid credentials', () => {
      const service = new EmailService({
        user: 'test@example.com',
        pass: 'password123'
      });
      
      expect(service.user).toBe('test@example.com');
      expect(service.pass).toBe('password123');
      expect(service.host).toBe('smtp.gmail.com');
      expect(service.transporter).toBeNull();
    });

    test('should allow custom host', () => {
      const service = new EmailService({
        user: 'test@example.com',
        pass: 'password123',
        host: 'custom.smtp.com'
      });
      
      expect(service.host).toBe('custom.smtp.com');
    });

    test('should throw error without credentials', () => {
      expect(() => {
        new EmailService();
      }).toThrow('No email credentials provided.');
      
      expect(() => {
        new EmailService({ user: 'test@example.com' });
      }).toThrow('No email credentials provided.');
      
      expect(() => {
        new EmailService({ pass: 'password123' });
      }).toThrow('No email credentials provided.');
    });

    test('should handle empty credentials', () => {
      expect(() => {
        new EmailService({ user: '', pass: '' });
      }).toThrow('No email credentials provided.');
    });
  });

  describe('init()', () => {
    test('should create test account in development', async () => {
      process.env.NODE_ENV = 'development';
      
      const service = new EmailService({
        user: 'test@example.com',
        pass: 'password123'
      });
      
      await service.init();
      
      expect(mockNodemailer.createTestAccount).toHaveBeenCalled();
      expect(service.user).toBe('test@ethereal.email');
      expect(service.pass).toBe('testpass123');
      expect(service.host).toBe('smtp.ethereal.email');
      expect(mockNodemailer.createTransport).toHaveBeenCalled();
    });

    test('should use provided credentials in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const service = new EmailService({
        user: 'prod@example.com',
        pass: 'prodpass'
      });
      
      await service.init();
      
      expect(mockNodemailer.createTestAccount).not.toHaveBeenCalled();
      expect(service.user).toBe('prod@example.com');
      expect(service.pass).toBe('prodpass');
      expect(mockNodemailer.createTransport).toHaveBeenCalled();
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should not recreate transporter if already exists', async () => {
      const service = new EmailService({
        user: 'test@example.com',
        pass: 'password123'
      });
      
      const customMockTransporter = { close: jest.fn() };
      service.transporter = customMockTransporter;
      
      await service.init();
      
      expect(service.transporter).toBe(customMockTransporter);
      expect(mockNodemailer.createTransport).not.toHaveBeenCalled();
    });

    test('should create transporter with correct configuration', async () => {
      const service = new EmailService({
        user: 'test@example.com',
        pass: 'password123'
      });
      
      await service.init();
      
      expect(mockNodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: 'test@ethereal.email', pass: 'testpass123' },
        tls: { rejectUnauthorized: false },
        pool: true,
      });
    });
  });

  describe('close()', () => {
    test('should close transporter if exists', () => {
      const service = new EmailService({
        user: 'test@example.com',
        pass: 'password123'
      });
      
      const mockTransporter = { close: jest.fn() };
      service.transporter = mockTransporter;
      
      service.close();
      
      expect(mockTransporter.close).toHaveBeenCalled();
    });

    test('should not error if transporter is null', () => {
      const service = new EmailService({
        user: 'test@example.com',
        pass: 'password123'
      });
      
      expect(() => service.close()).not.toThrow();
    });
  });

  describe('build()', () => {
    test('should build mail object with default values', () => {
      const service = new EmailService({
        user: 'test@example.com',
        pass: 'password123'
      });
      
      const result = service.build({});
      
      expect(service.mail).toEqual({
        subject: 'Subject',
        text: 'No plain text version were sent',
        html: '<b>This email is empty</b>'
      });
      expect(result).toBe(service);
    });

    test('should build mail object with custom values', () => {
      const service = new EmailService({
        user: 'test@example.com',
        pass: 'password123'
      });
      
      service.build({
        subject: 'Custom Subject',
        text: 'Custom text',
        html: '<p>Custom HTML</p>'
      });
      
      expect(service.mail).toEqual({
        subject: 'Custom Subject',
        text: 'Custom text',
        html: '<p>Custom HTML</p>'
      });
    });

    test('should return service instance for chaining', () => {
      const service = new EmailService({
        user: 'test@example.com',
        pass: 'password123'
      });
      
      const result = service.build({});
      
      expect(result).toBe(service);
    });
  });

  describe('send()', () => {
    let service;
    let mockTransporter;

    beforeEach(() => {
      service = new EmailService({
        user: 'test@example.com',
        pass: 'password123'
      });
      
      mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({
          messageId: 'test-message-id',
          response: '250 OK'
        }),
        close: jest.fn()
      };
      
      mockNodemailer.createTransport.mockReturnValue(mockTransporter);
    });

    test('should send email with provided parameters', async () => {
      const result = await service.send({
        receiver: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test message'
      });
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"Sender Name" <sender@address.com>',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test message',
        html: '<b>This email is empty</b>'
      });
      
      expect(result.messageId).toBe('test-message-id');
    });

    test('should use build method if mail not pre-built', async () => {
      const buildSpy = jest.spyOn(service, 'build');
      
      await service.send({
        receiver: 'test@example.com',
        subject: 'Test',
        text: 'Test message'
      });
      
      expect(buildSpy).toHaveBeenCalledWith({
        subject: 'Test',
        text: 'Test message',
        html: undefined,
        template: undefined
      });
    });

    test('should not rebuild if mail already exists', async () => {
      service.build({ subject: 'Pre-built', text: 'Pre-built text' });
      const buildSpy = jest.spyOn(service, 'build');
      
      await service.send({
        receiver: 'test@example.com'
      });
      
      expect(buildSpy).not.toHaveBeenCalled();
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Pre-built',
          text: 'Pre-built text'
        })
      );
    });

    test('should handle string sender format', async () => {
      await service.send({
        receiver: 'test@example.com',
        sender: 'custom@sender.com',
        subject: 'Test'
      });
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'custom@sender.com'
        })
      );
    });

    test('should handle object sender format', async () => {
      await service.send({
        receiver: 'test@example.com',
        sender: { name: 'Custom Name', address: 'custom@sender.com' },
        subject: 'Test'
      });
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"Custom Name" <custom@sender.com>'
        })
      );
    });

    test('should include preview URL in development', async () => {
      process.env.NODE_ENV = 'development';
      mockNodemailer.getTestMessageUrl.mockReturnValue('https://ethereal.email/message/test123');
      
      const result = await service.send({
        receiver: 'test@example.com',
        subject: 'Test'
      });
      
      expect(result.preview).toBe('https://ethereal.email/message/test123');
      expect(mockNodemailer.getTestMessageUrl).toHaveBeenCalled();
    });

    test('should not include preview URL in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const result = await service.send({
        receiver: 'test@example.com',
        subject: 'Test'
      });
      
      expect(result.preview).toBeUndefined();
      expect(mockNodemailer.getTestMessageUrl).not.toHaveBeenCalled();
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should log verbose output when enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockNodemailer.getTestMessageUrl.mockReturnValue('https://ethereal.email/message/test123');
      
      await service.send({
        receiver: 'test@example.com',
        subject: 'Test',
        verbose: true
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('Preview URL: %s', 'https://ethereal.email/message/test123');
      expect(consoleSpy).toHaveBeenCalledWith('Message sent: %s', 'test-message-id');
      
      consoleSpy.mockRestore();
    });

    test('should handle sendMail errors', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP Error'));
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await expect(service.send({
        receiver: 'test@example.com',
        subject: 'Test'
      })).rejects.toThrow('Could not send email.');
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
      consoleSpy.mockRestore();
    });

    test('should initialize before sending', async () => {
      const initSpy = jest.spyOn(service, 'init');
      
      await service.send({
        receiver: 'test@example.com',
        subject: 'Test'
      });
      
      expect(initSpy).toHaveBeenCalled();
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    test('should handle createTestAccount failure', async () => {
      mockNodemailer.createTestAccount.mockRejectedValue(new Error('Ethereal error'));
      
      const service = new EmailService({
        user: 'test@example.com',
        pass: 'password123'
      });
      
      await expect(service.init()).rejects.toThrow('Ethereal error');
    });

    test('should handle createTransport failure', async () => {
      mockNodemailer.createTransport.mockImplementation(() => {
        throw new Error('Transport error');
      });
      
      const service = new EmailService({
        user: 'test@example.com',
        pass: 'password123'
      });
      
      await expect(service.init()).rejects.toThrow('Transport error');
    });

    test('should handle missing receiver', async () => {
      const service = new EmailService({
        user: 'test@example.com',
        pass: 'password123'
      });
      
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({
          messageId: 'test-id'
        })
      };
      
      mockNodemailer.createTransport.mockReturnValue(mockTransporter);
      
      await service.send({
        subject: 'Test'
      });
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: false
        })
      );
    });

    test('should handle null and undefined values gracefully', async () => {
      const service = new EmailService({
        user: 'test@example.com',
        pass: 'password123'
      });
      
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' })
      };
      
      mockNodemailer.createTransport.mockReturnValue(mockTransporter);
      
      await service.send({
        receiver: null,
        sender: undefined,
        subject: null,
        text: undefined
      });
      
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    test('should handle very long email content', async () => {
      const service = new EmailService({
        user: 'test@example.com',
        pass: 'password123'
      });
      
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' })
      };
      
      mockNodemailer.createTransport.mockReturnValue(mockTransporter);
      
      const longText = 'A'.repeat(100000);
      const longHtml = '<p>' + 'B'.repeat(100000) + '</p>';
      
      await service.send({
        receiver: 'test@example.com',
        subject: 'Long content test',
        text: longText,
        html: longHtml
      });
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: longText,
          html: longHtml
        })
      );
    });

    test('should handle multiple concurrent sends', async () => {
      const service = new EmailService({
        user: 'test@example.com',
        pass: 'password123'
      });
      
      const mockTransporter = {
        sendMail: jest.fn().mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({ messageId: 'test-id' }), 10)
          )
        )
      };
      
      mockNodemailer.createTransport.mockReturnValue(mockTransporter);
      
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(service.send({
          receiver: `test${i}@example.com`,
          subject: `Test ${i}`
        }));
      }
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(10);
    });
  });
});