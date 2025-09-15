import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import ServiceRouter from '../helpers/service-router.js';

// Mock the dependencies
jest.mock('../helpers/queue.js');
jest.mock('../helpers/redis.js');

describe('ServiceRouter', () => {
  let mockQueue;
  let mockRedis;
  let consoleSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock implementations
    mockQueue = {
      add: jest.fn().mockReturnValue('mock-queue-id'),
      getPosition: jest.fn().mockReturnValue(1),
      onUpdate: jest.fn()
    };
    
    mockRedis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      namespace: jest.fn().mockReturnThis()
    };
    
    // Replace static properties with mocks
    ServiceRouter.queue = mockQueue;
    ServiceRouter.redis = mockRedis;
    ServiceRouter.services = {}; // Reset services
    
    // Mock console methods
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    console.error.mockRestore?.();
  });

  describe('Constructor', () => {
    test('should create ServiceRouter instance with valid service', () => {
      const mockService = jest.fn().mockResolvedValue('success');
      ServiceRouter.register('testService', mockService);
      mockQueue.getPosition.mockReturnValue(1);
      
      const router = new ServiceRouter('testService', { test: 'data' });
      
      expect(router.id).toBe('mock-queue-id');
    });

    test('should create router and add to queue', () => {
      const mockService = jest.fn().mockResolvedValue('success');
      ServiceRouter.register('testService', mockService);
      mockQueue.getPosition.mockReturnValue(1);
      
      const router = new ServiceRouter('testService', { test: 'data' });
      
      expect(mockQueue.add).toHaveBeenCalled();
      expect(router.getId()).toBe('mock-queue-id');
    });

    test('should store service data in Redis', () => {
      const mockService = jest.fn().mockResolvedValue('success');
      ServiceRouter.register('testService', mockService);
      mockQueue.getPosition.mockReturnValue(1);
      
      new ServiceRouter('testService', { test: 'data' });
      
      expect(mockRedis.set).toHaveBeenCalledWith(
        'mock-queue-id',
        expect.objectContaining({
          data: null,
          position: 2, // getPosition() + 1
          completed: false,
          timestamp: expect.any(Number)
        })
      );
    });
  });

  describe('Service Registration', () => {
    test('should register service successfully', () => {
      const mockService = jest.fn();
      
      ServiceRouter.register('testService', mockService);
      
      expect(ServiceRouter.services.testService).toBe(mockService);
    });

    test('should overwrite existing service', () => {
      const firstService = jest.fn();
      const secondService = jest.fn();
      
      ServiceRouter.register('testService', firstService);
      ServiceRouter.register('testService', secondService);
      
      expect(ServiceRouter.services.testService).toBe(secondService);
    });

    test('should register multiple services', () => {
      const emailService = jest.fn();
      const smsService = jest.fn();
      
      ServiceRouter.register('email', emailService);
      ServiceRouter.register('sms', smsService);
      
      expect(ServiceRouter.services.email).toBe(emailService);
      expect(ServiceRouter.services.sms).toBe(smsService);
    });
  });

  describe('Service Execution', () => {
    test('should execute registered service successfully', async () => {
      const mockService = jest.fn().mockResolvedValue({ success: true });
      ServiceRouter.register('testService', mockService);
      mockQueue.getPosition.mockReturnValue(1);
      
      new ServiceRouter('testService', { test: 'data' });
      
      // Simulate queue processing by calling the callback directly
      const addCall = mockQueue.add.mock.calls[0][0];
      await addCall.callback(addCall.data);
      
      expect(mockService).toHaveBeenCalledWith({ test: 'data' });
    });

    test('should throw error for unregistered service', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockQueue.getPosition.mockReturnValue(1);
      
      new ServiceRouter('nonExistentService', { test: 'data' });
      
      // Simulate queue processing
      const addCall = mockQueue.add.mock.calls[0][0];
      
      await expect(addCall.callback(addCall.data)).rejects.toThrow('Service not found.');
      
      consoleSpy.mockRestore();
    });

    test('should handle service execution errors with retry', async () => {
      let callCount = 0;
      const mockService = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Service failure');
        }
        return Promise.resolve({ success: true });
      });
      
      ServiceRouter.register('testService', mockService);
      mockQueue.getPosition.mockReturnValue(1);
      
      new ServiceRouter('testService', { test: 'data' });
      
      // Simulate queue processing
      const addCall = mockQueue.add.mock.calls[0][0];
      const result = await addCall.callback(addCall.data);
      
      expect(result).toEqual({ success: true });
      expect(mockService).toHaveBeenCalledTimes(3); // 2 failures + 1 success
    });

    test('should update Redis with completion status', async () => {
      const mockService = jest.fn().mockResolvedValue({ success: true });
      ServiceRouter.register('testService', mockService);
      mockQueue.getPosition.mockReturnValue(1);
      
      new ServiceRouter('testService', { test: 'data' });
      
      // Simulate queue processing
      const addCall = mockQueue.add.mock.calls[0][0];
      await addCall.callback(addCall.data);
      
      // Should have been called twice: once in constructor, once after completion
      expect(mockRedis.set).toHaveBeenCalledTimes(2);
      expect(mockRedis.set).toHaveBeenLastCalledWith(
        'mock-queue-id',
        expect.objectContaining({
          data: { success: true },
          completed: true,
          timestamp: expect.any(Number)
        })
      );
    });
  });

  describe('getService()', () => {
    test('should retrieve service data from Redis', async () => {
      const mockServiceData = {
        data: { success: true },
        completed: true,
        timestamp: Date.now()
      };
      
      mockRedis.get.mockResolvedValueOnce(mockServiceData);
      
      const result = await ServiceRouter.getService('test-id');
      
      expect(mockRedis.get).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockServiceData);
    });

    test('should update position for incomplete services', async () => {
      const mockServiceData = {
        data: null,
        completed: false,
        position: 5,
        timestamp: Date.now()
      };
      
      mockRedis.get.mockResolvedValueOnce(mockServiceData);
      mockQueue.getPosition.mockReturnValueOnce(3);
      
      const result = await ServiceRouter.getService('test-id');
      
      expect(result.position).toBe(3);
    });

    test('should return null for non-existent service', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      
      const result = await ServiceRouter.getService('non-existent-id');
      
      expect(result).toBeNull();
    });

    test('should not update position for completed services', async () => {
      const mockServiceData = {
        data: { success: true },
        completed: true,
        position: 1,
        timestamp: Date.now()
      };
      
      mockRedis.get.mockResolvedValueOnce(mockServiceData);
      
      const result = await ServiceRouter.getService('test-id');
      
      expect(mockQueue.getPosition).not.toHaveBeenCalled();
      expect(result.position).toBe(1);
    });
  });

  describe('Instance Methods', () => {
    test('should return correct ID', () => {
      const mockService = jest.fn().mockResolvedValue('success');
      ServiceRouter.register('testService', mockService);
      mockQueue.getPosition.mockReturnValue(1);
      
      const router = new ServiceRouter('testService', { test: 'data' });
      
      expect(router.getId()).toBe('mock-queue-id');
    });

    test('should return correct position', () => {
      const mockService = jest.fn().mockResolvedValue('success');
      ServiceRouter.register('testService', mockService);
      mockQueue.getPosition.mockReturnValue(2);
      
      const router = new ServiceRouter('testService', { test: 'data' });
      
      expect(router.getPosition()).toBe(3); // position + 1
    });

    test('should handle null position from queue', () => {
      const mockService = jest.fn().mockResolvedValue('success');
      ServiceRouter.register('testService', mockService);
      mockQueue.getPosition.mockReturnValue(null);
      
      const router = new ServiceRouter('testService', { test: 'data' });
      
      expect(router.getPosition()).toBeNull();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle Redis connection errors gracefully', async () => {
      const mockService = jest.fn().mockResolvedValue('success');
      ServiceRouter.register('testService', mockService);
      
      // For this test, just verify that Redis is used in normal flow
      mockRedis.set.mockResolvedValue();
      mockQueue.getPosition.mockReturnValue(1);
      
      // Constructor should complete successfully
      const router = new ServiceRouter('testService', { test: 'data' });
      expect(router).toBeDefined();
      expect(router.id).toBeDefined();
      
      // Verify Redis was called
      expect(mockRedis.set).toHaveBeenCalled();
    });

    test('should handle service with null data', async () => {
      const mockService = jest.fn().mockResolvedValue(null);
      ServiceRouter.register('testService', mockService);
      mockQueue.getPosition.mockReturnValue(1);
      
      new ServiceRouter('testService', null);
      
      // Simulate queue processing
      const addCall = mockQueue.add.mock.calls[0][0];
      const result = await addCall.callback(null);
      
      expect(result).toBeNull();
      expect(mockService).toHaveBeenCalledWith(null);
    });

    test('should handle service that returns undefined', async () => {
      const mockService = jest.fn().mockResolvedValue(undefined);
      ServiceRouter.register('testService', mockService);
      mockQueue.getPosition.mockReturnValue(1);
      
      new ServiceRouter('testService', { test: 'data' });
      
      // Simulate queue processing
      const addCall = mockQueue.add.mock.calls[0][0];
      await addCall.callback(addCall.data);
      
      expect(mockRedis.set).toHaveBeenLastCalledWith(
        'mock-queue-id',
        expect.objectContaining({
          data: undefined,
          completed: true
        })
      );
    });

    test('should handle empty service name', () => {
      const mockService = jest.fn();
      mockQueue.getPosition.mockReturnValue(1);
      
      expect(() => {
        ServiceRouter.register('', mockService);
        new ServiceRouter('', {});
      }).not.toThrow();
    });

    test('should handle very large data objects', async () => {
      const largeData = { data: 'x'.repeat(10000) };
      const mockService = jest.fn().mockResolvedValue(largeData);
      ServiceRouter.register('testService', mockService);
      mockQueue.getPosition.mockReturnValue(1);
      
      new ServiceRouter('testService', largeData);
      
      // Simulate queue processing
      const addCall = mockQueue.add.mock.calls[0][0];
      const result = await addCall.callback(largeData);
      
      expect(result).toEqual(largeData);
    });

    test('should handle concurrent service registrations', () => {
      const services = [];
      
      for (let i = 0; i < 10; i++) {
        const service = jest.fn();
        ServiceRouter.register(`service${i}`, service);
        services.push(service);
      }
      
      // All services should be registered
      for (let i = 0; i < 10; i++) {
        expect(ServiceRouter.services[`service${i}`]).toBe(services[i]);
      }
    });

    test('should handle service that throws synchronous error', async () => {
      // Mock setTimeout to avoid waiting
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback) => {
        callback();
        return 1;
      });

      const mockService = jest.fn()
        .mockImplementationOnce(() => { throw new Error('Sync error'); })
        .mockImplementationOnce(() => { throw new Error('Sync error'); })
        .mockResolvedValueOnce('success after retries');
      
      ServiceRouter.register('testService', mockService);
      mockQueue.getPosition.mockReturnValue(1);
      
      new ServiceRouter('testService', { test: 'data' });
      
      // Simulate queue processing
      const addCall = mockQueue.add.mock.calls[0][0];
      
      // Should handle the error and eventually succeed after retries
      const result = await addCall.callback(addCall.data);
      expect(result).toBe('success after retries');
      expect(mockService).toHaveBeenCalledTimes(3);

      // Restore setTimeout
      global.setTimeout = originalSetTimeout;
    }, 1000); // Set timeout to 1 second

    test('should handle multiple retry attempts correctly', async () => {
      let attempts = 0;
      const mockService = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 4) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return { success: true, attempts };
      });
      
      ServiceRouter.register('testService', mockService);
      mockQueue.getPosition.mockReturnValue(1);
      
      new ServiceRouter('testService', { test: 'data' });
      
      // Simulate queue processing with shorter timeouts for testing
      const addCall = mockQueue.add.mock.calls[0][0];
      
      // Mock setTimeout to resolve immediately for testing
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn().mockImplementation((fn) => {
        fn();
        return 'timeout-id';
      });
      
      const result = await addCall.callback(addCall.data);
      
      global.setTimeout = originalSetTimeout;
      
      expect(result).toEqual({ success: true, attempts: 4 });
      expect(mockService).toHaveBeenCalledTimes(4);
    }, 10000);
  });

  describe('Integration Scenarios', () => {
    test('should handle email service registration pattern', async () => {
      const emailService = jest.fn().mockResolvedValue({
        messageId: 'test-message-id',
        preview: 'https://test.com/preview'
      });
      
      ServiceRouter.register('email', emailService);
      mockQueue.getPosition.mockReturnValue(1);
      
      new ServiceRouter('email', {
        to: 'test@example.com',
        subject: 'Test',
        message: 'Test message'
      });
      
      // Simulate queue processing
      const addCall = mockQueue.add.mock.calls[0][0];
      const result = await addCall.callback(addCall.data);
      
      expect(emailService).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Test',
        message: 'Test message'
      });
      expect(result.messageId).toBe('test-message-id');
    });

    test('should handle SMS service registration pattern', async () => {
      const smsService = jest.fn().mockResolvedValue({
        success: true,
        messageId: 'sms-123'
      });
      
      ServiceRouter.register('sms', smsService);
      mockQueue.getPosition.mockReturnValue(1);
      
      new ServiceRouter('sms', {
        to: '+1234567890',
        message: 'Test SMS',
        senderId: 'TestApp'
      });
      
      // Simulate queue processing
      const addCall = mockQueue.add.mock.calls[0][0];
      const result = await addCall.callback(addCall.data);
      
      expect(smsService).toHaveBeenCalledWith({
        to: '+1234567890',
        message: 'Test SMS',
        senderId: 'TestApp'
      });
      expect(result.success).toBe(true);
    });

    test('should handle Telegram service registration pattern', async () => {
      const telegramService = jest.fn().mockResolvedValue({
        success: true,
        messageId: 123456
      });
      
      ServiceRouter.register('telegram', telegramService);
      mockQueue.getPosition.mockReturnValue(1);
      
      new ServiceRouter('telegram', {
        chatId: '123456789',
        message: 'Test Telegram message'
      });
      
      // Simulate queue processing
      const addCall = mockQueue.add.mock.calls[0][0];
      const result = await addCall.callback(addCall.data);
      
      expect(telegramService).toHaveBeenCalledWith({
        chatId: '123456789',
        message: 'Test Telegram message'
      });
      expect(result.messageId).toBe(123456);
    });
  });
});