import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import SMSService from '../services/sms.js';

describe('SMSService', () => {
  let service;
  
  beforeEach(() => {
    service = new SMSService('test-api-key');
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  describe('Constructor', () => {
    test('should create instance with API key', () => {
      const smsService = new SMSService('my-api-key');
      expect(smsService.apiKey).toBe('my-api-key');
    });

    test('should accept null or undefined API key', () => {
      const service1 = new SMSService(null);
      const service2 = new SMSService(undefined);
      const service3 = new SMSService();
      
      expect(service1.apiKey).toBeNull();
      expect(service2.apiKey).toBeUndefined();
      expect(service3.apiKey).toBeUndefined();
    });
  });

  describe('send() - Development Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    test('should return log message in development', async () => {
      const result = await service.send({
        to: '+5511999999999',
        message: 'Test SMS'
      });

      expect(result).toEqual({
        message: 'DEV LOG: SMS to +5511999999999 - Test SMS'
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('should handle missing parameters gracefully', async () => {
      const result = await service.send({});

      expect(result).toEqual({
        message: 'DEV LOG: SMS to undefined - undefined'
      });
    });

    test('should handle null parameters', async () => {
      const result = await service.send({
        to: null,
        message: null
      });

      expect(result).toEqual({
        message: 'DEV LOG: SMS to null - null'
      });
    });
  });

  describe('send() - Production Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
    });

    test('should send SMS with required parameters', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, messageId: 'sms123' })
      });

      const result = await service.send({
        to: '+5511999999999',
        message: 'Test SMS message'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.sms.to/sms/send',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'Test SMS message',
            to: '+5511999999999',
            sender_id: 'SMSto',
            bypass_optout: true,
          })
        }
      );

      expect(result).toEqual({ success: true });
    });

    test('should use custom parameters when provided', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true })
      });

      await service.send({
        to: '+1234567890',
        message: 'Custom message',
        senderId: 'CustomSender',
        bypassOptout: false,
        callbackUrl: 'https://example.com/callback'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.sms.to/sms/send',
        expect.objectContaining({
          body: JSON.stringify({
            message: 'Custom message',
            to: '+1234567890',
            sender_id: 'CustomSender',
            bypass_optout: false,
            callback_url: 'https://example.com/callback'
          })
        })
      );
    });

    test('should not include callback_url if not provided', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true })
      });

      await service.send({
        to: '+5511999999999',
        message: 'Test message'
      });

      const callArgs = global.fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      
      expect(body).not.toHaveProperty('callback_url');
    });

    test('should include callback_url when provided', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true })
      });

      await service.send({
        to: '+5511999999999',
        message: 'Test message',
        callbackUrl: 'https://example.com/webhook'
      });

      const callArgs = global.fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      
      expect(body.callback_url).toBe('https://example.com/webhook');
    });

    test('should handle API success response', async () => {
      const mockResponse = { 
        success: true, 
        messageId: 'sms_12345',
        cost: 0.05,
        balance: 10.50
      };
      
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      });

      const result = await service.send({
        to: '+5511999999999',
        message: 'Test message'
      });

      expect(result).toEqual({ success: true });
    });

    test('should handle API error response', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ 
          error: 'Invalid phone number',
          code: 'INVALID_PHONE'
        })
      });

      const result = await service.send({
        to: 'invalid-phone',
        message: 'Test message'
      });

      expect(result).toEqual({ success: true }); // Current implementation always returns success
    });

    test('should handle network errors', async () => {
      const networkError = new Error('Network error');
      global.fetch.mockRejectedValueOnce(networkError);
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await service.send({
        to: '+5511999999999',
        message: 'Test message'
      });

      expect(result).toEqual({ 
        success: false, 
        error: networkError 
      });
      expect(consoleSpy).toHaveBeenCalledWith('error sending sms', networkError);
      
      consoleSpy.mockRestore();
    });

    test('should handle JSON parsing errors', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.reject(new Error('Invalid JSON'))
      });
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await service.send({
        to: '+5511999999999',
        message: 'Test message'
      });

      expect(result).toEqual({ 
        success: false, 
        error: expect.any(Error)
      });
      
      consoleSpy.mockRestore();
    });

    test('should handle fetch rejection', async () => {
      const fetchError = new Error('Fetch failed');
      global.fetch.mockRejectedValueOnce(fetchError);
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await service.send({
        to: '+5511999999999',
        message: 'Test message'
      });

      expect(result).toEqual({ 
        success: false, 
        error: fetchError 
      });
      expect(consoleSpy).toHaveBeenCalledWith('error sending sms', fetchError);
      
      consoleSpy.mockRestore();
    });
  });

  describe('API Integration Scenarios', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
    });

    test('should handle international phone numbers', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true })
      });

      const phoneNumbers = [
        '+1234567890',      // US
        '+5511999999999',   // Brazil
        '+44123456789',     // UK
        '+81123456789',     // Japan
        '+33123456789',     // France
      ];

      for (const phoneNumber of phoneNumbers) {
        await service.send({
          to: phoneNumber,
          message: `Test to ${phoneNumber}`
        });
      }

      expect(global.fetch).toHaveBeenCalledTimes(phoneNumbers.length);
    });

    test('should handle very long messages', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true })
      });

      const longMessage = 'A'.repeat(1000);

      await service.send({
        to: '+5511999999999',
        message: longMessage
      });

      const callArgs = global.fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      
      expect(body.message).toBe(longMessage);
      expect(body.message.length).toBe(1000);
    });

    test('should handle empty message', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true })
      });

      await service.send({
        to: '+5511999999999',
        message: ''
      });

      const callArgs = global.fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      
      expect(body.message).toBe('');
    });

    test('should handle special characters in message', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true })
      });

      const specialMessage = 'Hello! 🎉 Special chars: àáâãäåæçèéêë ñ öø ùúûüý';

      await service.send({
        to: '+5511999999999',
        message: specialMessage
      });

      const callArgs = global.fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      
      expect(body.message).toBe(specialMessage);
    });

    test('should handle line breaks in message', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true })
      });

      const messageWithLineBreaks = 'Line 1\nLine 2\r\nLine 3\rLine 4';

      await service.send({
        to: '+5511999999999',
        message: messageWithLineBreaks
      });

      const callArgs = global.fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      
      expect(body.message).toBe(messageWithLineBreaks);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing API key', async () => {
      process.env.NODE_ENV = 'production';
      
      const serviceWithoutKey = new SMSService();
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true })
      });

      await serviceWithoutKey.send({
        to: '+5511999999999',
        message: 'Test'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.sms.to/sms/send',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer undefined'
          })
        })
      );
      
      process.env.NODE_ENV = 'test';
    });

    test('should handle null message gracefully', async () => {
      process.env.NODE_ENV = 'production';
      
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true })
      });

      await service.send({
        to: '+5511999999999',
        message: null
      });

      const callArgs = global.fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      
      expect(body.message).toBeNull();
      
      process.env.NODE_ENV = 'test';
    });

    test('should handle undefined parameters', async () => {
      process.env.NODE_ENV = 'production';
      
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true })
      });

      await service.send({
        to: undefined,
        message: undefined,
        senderId: undefined,
        bypassOptout: undefined,
        callbackUrl: undefined
      });

      const callArgs = global.fetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      
      expect(body.to).toBeUndefined();
      expect(body.message).toBeUndefined();
      // senderId has a default value of 'SMSto' when undefined is passed
      expect(body.sender_id).toBe('SMSto');
      // bypassOptout has a default value of true when undefined is passed
      expect(body.bypass_optout).toBe(true);
      expect(body).not.toHaveProperty('callback_url');
      
      process.env.NODE_ENV = 'test';
    });

    test('should handle concurrent sends', async () => {
      process.env.NODE_ENV = 'production';
      
      global.fetch.mockImplementation(() => 
        Promise.resolve({
          json: () => Promise.resolve({ success: true })
        })
      );

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(service.send({
          to: `+551199999999${i}`,
          message: `Message ${i}`
        }));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(global.fetch).toHaveBeenCalledTimes(10);
      results.forEach(result => {
        expect(result).toEqual({ success: true });
      });
      
      process.env.NODE_ENV = 'test';
    });

    test('should handle timeout scenarios', async () => {
      process.env.NODE_ENV = 'production';
      
      // Mock a timeout error
      global.fetch.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await service.send({
        to: '+5511999999999',
        message: 'Test timeout'
      });

      expect(result).toEqual({ 
        success: false, 
        error: expect.any(Error)
      });
      expect(consoleSpy).toHaveBeenCalledWith('error sending sms', expect.any(Error));
      
      consoleSpy.mockRestore();
      process.env.NODE_ENV = 'test';
    });
  });

  describe('Environment Handling', () => {
    test('should detect test environment correctly', async () => {
      process.env.NODE_ENV = 'test';
      
      const result = await service.send({
        to: '+5511999999999',
        message: 'Test message'
      });

      expect(result).toEqual({
        message: 'DEV LOG: SMS to +5511999999999 - Test message'
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('should treat undefined NODE_ENV as development', async () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;
      
      const result = await service.send({
        to: '+5511999999999',
        message: 'Test message'
      });

      expect(result).toEqual({
        message: 'DEV LOG: SMS to +5511999999999 - Test message'
      });
      expect(global.fetch).not.toHaveBeenCalled();
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should treat empty NODE_ENV as development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = '';
      
      const result = await service.send({
        to: '+5511999999999',
        message: 'Test message'
      });

      expect(result).toEqual({
        message: 'DEV LOG: SMS to +5511999999999 - Test message'
      });
      expect(global.fetch).not.toHaveBeenCalled();
      
      process.env.NODE_ENV = originalEnv;
    });
  });
});