import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';

// Mock ServiceRouter before importing app
const mockServiceRouter = jest.fn().mockImplementation((serviceName, data) => {
  return {
    id: 'mock-service-id',
    serviceName,
    data,
    getId: jest.fn().mockReturnValue('mock-service-id'),
    getPosition: jest.fn().mockReturnValue(1)
  };
});

// Add static method to the mock
mockServiceRouter.getService = jest.fn().mockResolvedValue({
  data: { success: true },
  completed: true,
  timestamp: Date.now(),
  position: 1
});

jest.unstable_mockModule('../helpers/service-router.js', () => ({
  default: mockServiceRouter
}));

// Mock the controller to prevent actual service registration
jest.unstable_mockModule('../controller.js', () => ({
  default: jest.fn()
}));

// Import app after mocking
const { default: app } = await import('../app.js');

describe('Express App Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockServiceRouter.mockClear();
    mockServiceRouter.getService.mockClear();
    
    // Restore the mock implementation after clearing
    mockServiceRouter.getService.mockResolvedValue({
      data: { success: true },
      completed: true,
      timestamp: Date.now(),
      position: 1
    });
  });

  describe('Health Check Endpoint', () => {
    test('GET /ready should return 200 with ready message', async () => {
      const response = await request(app)
        .get('/ready')
        .expect(200);

      expect(response.body).toEqual({
        message: 'I am ready!'
      });
    });

    test('GET /ready should have correct content type', async () => {
      const response = await request(app)
        .get('/ready')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
    });
  });

  describe('Email Endpoint', () => {
    test('POST /email should queue email and return queue info', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email',
        message: 'This is a test email'
      };

      const response = await request(app)
        .post('/email')
        .send(emailData)
        .expect(200);

      expect(response.body).toEqual({
        status: 'in queue',
        position: 1,
        id: 'mock-service-id'
      });
    });

    test('POST /email should accept JSON content type', async () => {
      const response = await request(app)
        .post('/email')
        .set('Content-Type', 'application/json')
        .send({
          to: 'test@example.com',
          subject: 'Test',
          message: 'Test message'
        })
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });

    test('POST /email should handle empty request body', async () => {
      const response = await request(app)
        .post('/email')
        .send({})
        .expect(200);

      expect(response.body).toEqual({
        status: 'in queue',
        position: 1,
        id: 'mock-service-id'
      });
    });

    test('POST /email should handle missing fields', async () => {
      const response = await request(app)
        .post('/email')
        .send({
          to: 'test@example.com'
          // Missing subject and message
        })
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });

    test('POST /email should handle large payload', async () => {
      const largeMessage = 'A'.repeat(50000);
      
      const response = await request(app)
        .post('/email')
        .send({
          to: 'test@example.com',
          subject: 'Large Email',
          message: largeMessage
        })
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });

    test('POST /email should handle special characters', async () => {
      const specialData = {
        to: 'tëst@éxämple.com',
        subject: 'Spëcial Çhäractersñ 🎉',
        message: 'Message with spëcial çhärs & émojis 🚀'
      };

      const response = await request(app)
        .post('/email')
        .send(specialData)
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });
  });

  describe('SMS Endpoint', () => {
    test('POST /sms should queue SMS and return queue info', async () => {
      const smsData = {
        to: '+5511999999999',
        message: 'Test SMS message',
        senderId: 'TestSender'
      };

      const response = await request(app)
        .post('/sms')
        .send(smsData)
        .expect(200);

      expect(response.body).toEqual({
        status: 'in queue',
        position: 1,
        id: 'mock-service-id'
      });
    });

    test('POST /sms should handle international phone numbers', async () => {
      const phoneNumbers = [
        '+1234567890',    // US
        '+5511999999999', // Brazil
        '+44123456789',   // UK
        '+81123456789',   // Japan
      ];

      for (const phoneNumber of phoneNumbers) {
        const response = await request(app)
          .post('/sms')
          .send({
            to: phoneNumber,
            message: `Test SMS to ${phoneNumber}`
          })
          .expect(200);

        expect(response.body.status).toBe('in queue');
      }
    });

    test('POST /sms should handle empty message', async () => {
      const response = await request(app)
        .post('/sms')
        .send({
          to: '+5511999999999',
          message: ''
        })
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });

    test('POST /sms should handle missing senderId', async () => {
      const response = await request(app)
        .post('/sms')
        .send({
          to: '+5511999999999',
          message: 'Test without sender ID'
        })
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });

    test('POST /sms should handle very long message', async () => {
      const longMessage = 'A'.repeat(1000);
      
      const response = await request(app)
        .post('/sms')
        .send({
          to: '+5511999999999',
          message: longMessage
        })
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });
  });

  describe('Telegram Endpoint', () => {
    test('POST /telegram should queue message and return queue info', async () => {
      const telegramData = {
        chatId: '123456789',
        message: 'Hello from Telegram Bot!'
      };

      const response = await request(app)
        .post('/telegram')
        .send(telegramData)
        .expect(200);

      expect(response.body).toEqual({
        status: 'in queue',
        position: 1,
        id: 'mock-service-id'
      });
    });

    test('POST /telegram should handle numeric chat ID', async () => {
      const response = await request(app)
        .post('/telegram')
        .send({
          chatId: 123456789,
          message: 'Test with numeric chat ID'
        })
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });

    test('POST /telegram should handle negative chat ID (groups)', async () => {
      const response = await request(app)
        .post('/telegram')
        .send({
          chatId: '-123456789',
          message: 'Test group message'
        })
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });

    test('POST /telegram should handle channel username format', async () => {
      const response = await request(app)
        .post('/telegram')
        .send({
          chatId: '@mychannel',
          message: 'Test channel message'
        })
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });

    test('POST /telegram should handle markdown formatting', async () => {
      const markdownMessage = '*Bold* _italic_ `code` [link](https://example.com)';
      
      const response = await request(app)
        .post('/telegram')
        .send({
          chatId: '123456789',
          message: markdownMessage
        })
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });

    test('POST /telegram should handle emojis', async () => {
      const emojiMessage = '🎉 🚀 🤖 😀 👍 ❤️ 🔥 ⭐';
      
      const response = await request(app)
        .post('/telegram')
        .send({
          chatId: '123456789',
          message: emojiMessage
        })
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });
  });

  describe('Service Status Endpoint', () => {
    test('GET /service/:id should return service status', async () => {
      const response = await request(app)
        .get('/service/test-service-id')
        .expect(200);

      expect(response.body).toEqual({
        data: { success: true },
        completed: true,
        timestamp: expect.any(Number),
        position: 1
      });
    });

    test('GET /service/:id should return 404 for non-existent service', async () => {
      // Mock the getService to return null for non-existent service
      const ServiceRouter = (await import('../helpers/service-router.js')).default;
      ServiceRouter.getService = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/service/non-existent-id')
        .expect(404);

      expect(response.body).toEqual({
        message: 'Service not found.'
      });
    });

    test('GET /service/:id should handle special characters in ID', async () => {
      const response = await request(app)
        .get('/service/test-id-with-special-chars-123!')
        .expect(200);

      expect(response.body.completed).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/non-existent-endpoint')
        .expect(404);

      expect(response.body).toEqual({
        message: 'I am sorry, but I think you are lost.'
      });
    });

    test('should return 404 for POST to non-existent endpoints', async () => {
      const response = await request(app)
        .post('/non-existent-endpoint')
        .send({ data: 'test' })
        .expect(404);

      expect(response.body.message).toContain('lost');
    });

    test('should return 404 for other HTTP methods', async () => {
      const putResponse = await request(app)
        .put('/email')
        .send({ data: 'test' })
        .expect(404);

      const deleteResponse = await request(app)
        .delete('/sms')
        .expect(404);

      const patchResponse = await request(app)
        .patch('/telegram')
        .send({ data: 'test' })
        .expect(404);

      expect(putResponse.body.message).toContain('lost');
      expect(deleteResponse.body.message).toContain('lost');
      expect(patchResponse.body.message).toContain('lost');
    });
  });

  describe('Request Body Size Limits', () => {
    test('should handle requests within size limit', async () => {
      const moderateData = {
        to: 'test@example.com',
        subject: 'Test',
        message: 'A'.repeat(1000) // 1KB
      };

      const response = await request(app)
        .post('/email')
        .send(moderateData)
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });

    test('should reject requests exceeding size limit', async () => {
      const largeData = {
        to: 'test@example.com',
        subject: 'Test',
        message: 'A'.repeat(2000000) // ~2MB, exceeds 1024kb limit
      };

      await request(app)
        .post('/email')
        .send(largeData)
        .expect(413); // Payload Too Large
    });
  });

  describe('Content Type Handling', () => {
    test('should accept application/json', async () => {
      const response = await request(app)
        .post('/email')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({
          to: 'test@example.com',
          subject: 'JSON test'
        }))
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });

    test('should accept application/x-www-form-urlencoded', async () => {
      const response = await request(app)
        .post('/email')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('to=test@example.com&subject=Form test')
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });

    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/email')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400); // Bad Request for malformed JSON
    });
  });

  describe('CORS Headers', () => {
    test('should include CORS headers', async () => {
      const response = await request(app)
        .get('/ready')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('should handle OPTIONS preflight requests', async () => {
      const response = await request(app)
        .options('/email')
        .set('Origin', 'https://example.com')
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);

      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });

  describe('Concurrent Requests', () => {
    test('should handle multiple concurrent requests', async () => {
      const promises = [];
      
      // Create 20 concurrent requests
      for (let i = 0; i < 20; i++) {
        promises.push(
          request(app)
            .post('/email')
            .send({
              to: `test${i}@example.com`,
              subject: `Concurrent Test ${i}`,
              message: `Message ${i}`
            })
        );
      }

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('in queue');
        expect(response.body.id).toBeDefined();
      });
    });

    test('should handle mixed endpoint concurrent requests', async () => {
      const promises = [
        request(app).post('/email').send({ to: 'test@example.com', subject: 'Test' }),
        request(app).post('/sms').send({ to: '+5511999999999', message: 'Test SMS' }),
        request(app).post('/telegram').send({ chatId: '123456789', message: 'Test Telegram' }),
        request(app).get('/ready'),
        request(app).get('/service/test-id')
      ];

      const responses = await Promise.all(promises);

      expect(responses[0].status).toBe(200); // email
      expect(responses[1].status).toBe(200); // sms
      expect(responses[2].status).toBe(200); // telegram
      expect(responses[3].status).toBe(200); // ready
      expect(responses[4].status).toBe(200); // service status
    });
  });

  describe('Edge Cases and Security', () => {
    test('should handle requests with null values', async () => {
      const response = await request(app)
        .post('/email')
        .send({
          to: null,
          subject: null,
          message: null
        })
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });

    test('should handle requests with undefined values', async () => {
      const response = await request(app)
        .post('/email')
        .send({
          to: undefined,
          subject: undefined,
          message: undefined
        })
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });

    test('should handle requests with array values', async () => {
      const response = await request(app)
        .post('/email')
        .send({
          to: ['test1@example.com', 'test2@example.com'],
          subject: 'Array test',
          message: 'Test message'
        })
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });

    test('should handle requests with object values', async () => {
      const response = await request(app)
        .post('/email')
        .send({
          to: { email: 'test@example.com', name: 'Test User' },
          subject: 'Object test',
          message: 'Test message'
        })
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });

    test('should handle deeply nested objects', async () => {
      const complexData = {
        to: 'test@example.com',
        subject: 'Complex test',
        message: 'Test message',
        metadata: {
          level1: {
            level2: {
              level3: {
                value: 'deep value'
              }
            }
          },
          array: [1, 2, { nested: 'object' }]
        }
      };

      const response = await request(app)
        .post('/email')
        .send(complexData)
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });

    test('should handle requests with extra fields', async () => {
      const response = await request(app)
        .post('/email')
        .send({
          to: 'test@example.com',
          subject: 'Extra fields test',
          message: 'Test message',
          extraField1: 'should be ignored',
          extraField2: 12345,
          extraField3: { nested: 'object' }
        })
        .expect(200);

      expect(response.body.status).toBe('in queue');
    });
  });

  describe('Response Format Consistency', () => {
    test('all service endpoints should return consistent format', async () => {
      const emailResponse = await request(app)
        .post('/email')
        .send({ to: 'test@example.com', subject: 'Test' })
        .expect(200);

      const smsResponse = await request(app)
        .post('/sms')
        .send({ to: '+5511999999999', message: 'Test' })
        .expect(200);

      const telegramResponse = await request(app)
        .post('/telegram')
        .send({ chatId: '123456789', message: 'Test' })
        .expect(200);

      // All should have the same response structure
      [emailResponse, smsResponse, telegramResponse].forEach(response => {
        expect(response.body).toHaveProperty('status', 'in queue');
        expect(response.body).toHaveProperty('position');
        expect(response.body).toHaveProperty('id');
        expect(typeof response.body.position).toBe('number');
        expect(typeof response.body.id).toBe('string');
      });
    });

    test('error responses should have consistent format', async () => {
      const notFoundResponse = await request(app)
        .get('/non-existent')
        .expect(404);

      expect(notFoundResponse.body).toHaveProperty('message');
      expect(typeof notFoundResponse.body.message).toBe('string');
    });
  });
});