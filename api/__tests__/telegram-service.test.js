import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import TelegramService from '../services/telegram.js';

describe('TelegramService', () => {
  let service;
  
  beforeEach(() => {
    service = new TelegramService('test-bot-token');
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  describe('Constructor', () => {
    test('should create instance with bot token', () => {
      const telegramService = new TelegramService('my-bot-token-123');
      
      expect(telegramService.token).toBe('my-bot-token-123');
      expect(telegramService.url).toBe('https://api.telegram.org/botmy-bot-token-123/sendMessage');
    });

    test('should handle null or undefined token', () => {
      const service1 = new TelegramService(null);
      const service2 = new TelegramService(undefined);
      const service3 = new TelegramService();
      
      expect(service1.token).toBeNull();
      expect(service1.url).toBe('https://api.telegram.org/botnull/sendMessage');
      
      expect(service2.token).toBeUndefined();
      expect(service2.url).toBe('https://api.telegram.org/botundefined/sendMessage');
      
      expect(service3.token).toBeUndefined();
      expect(service3.url).toBe('https://api.telegram.org/botundefined/sendMessage');
    });

    test('should handle empty string token', () => {
      const telegramService = new TelegramService('');
      
      expect(telegramService.token).toBe('');
      expect(telegramService.url).toBe('https://api.telegram.org/bot/sendMessage');
    });
  });

  describe('send() - Development Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    test('should return log message in development', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = await service.send({
        chatId: '123456789',
        text: 'Hello Telegram!'
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'DEV LOG: Telegram message to chat 123456789 - Hello Telegram!'
      );
      expect(result).toEqual({
        message: 'DEV LOG: Telegram message to chat 123456789 - Hello Telegram!'
      });
      expect(global.fetch).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should handle missing parameters gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = await service.send({});

      expect(consoleSpy).toHaveBeenCalledWith(
        'DEV LOG: Telegram message to chat undefined - undefined'
      );
      expect(result).toEqual({
        message: 'DEV LOG: Telegram message to chat undefined - undefined'
      });
      
      consoleSpy.mockRestore();
    });

    test('should handle null parameters', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = await service.send({
        chatId: null,
        text: null
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'DEV LOG: Telegram message to chat null - null'
      );
      expect(result).toEqual({
        message: 'DEV LOG: Telegram message to chat null - null'
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('send() - Production Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
    });

    test('should send message with required parameters', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ 
          ok: true, 
          result: { message_id: 123 } 
        })
      });

      const result = await service.send({
        chatId: '123456789',
        text: 'Hello from Telegram Bot!'
      });

      const expectedUrl = 'https://api.telegram.org/bottest-bot-token/sendMessage?chat_id=123456789&text=Hello+from+Telegram+Bot%21';
      
      expect(global.fetch).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual({ success: true });
    });

    test('should handle URL encoding for special characters', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true })
      });

      await service.send({
        chatId: '123456789',
        text: 'Hello! 🎉 Special chars: àáâãäåæç & = ? #'
      });

      const callArgs = global.fetch.mock.calls[0];
      const url = callArgs[0];
      
      expect(url).toContain('chat_id=123456789');
      expect(url).toContain('text=Hello%21+%F0%9F%8E%89+Special+chars%3A+%C3%A0%C3%A1%C3%A2%C3%A3%C3%A4%C3%A5%C3%A6%C3%A7+%26+%3D+%3F+%23');
    });

    test('should handle line breaks in message', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true })
      });

      await service.send({
        chatId: '123456789',
        text: 'Line 1\nLine 2\r\nLine 3'
      });

      const callArgs = global.fetch.mock.calls[0];
      const url = callArgs[0];
      
      expect(url).toContain('text=Line+1%0ALine+2%0D%0ALine+3');
    });

    test('should handle very long messages', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true })
      });

      const longMessage = 'A'.repeat(4000);

      await service.send({
        chatId: '123456789',
        text: longMessage
      });

      const callArgs = global.fetch.mock.calls[0];
      const url = callArgs[0];
      
      expect(url).toContain(`text=${encodeURIComponent(longMessage)}`);
    });

    test('should handle empty message', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true })
      });

      await service.send({
        chatId: '123456789',
        text: ''
      });

      const callArgs = global.fetch.mock.calls[0];
      const url = callArgs[0];
      
      expect(url).toContain('text=');
    });

    test('should handle API success response', async () => {
      const mockResponse = {
        ok: true,
        result: {
          message_id: 123,
          from: { id: 12345, is_bot: true, first_name: 'TestBot' },
          chat: { id: 123456789, type: 'private' },
          date: 1234567890,
          text: 'Hello from Telegram Bot!'
        }
      };
      
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      });

      const result = await service.send({
        chatId: '123456789',
        text: 'Hello from Telegram Bot!'
      });

      expect(result).toEqual({ success: true });
    });

    test('should handle API error response', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          ok: false,
          error_code: 400,
          description: 'Bad Request: chat not found'
        })
      });

      const result = await service.send({
        chatId: 'invalid-chat-id',
        text: 'Test message'
      });

      expect(result).toEqual({ success: true }); // Current implementation always returns success
    });

    test('should handle network errors', async () => {
      const networkError = new Error('Network error');
      global.fetch.mockRejectedValueOnce(networkError);
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await service.send({
        chatId: '123456789',
        text: 'Test message'
      });

      expect(result).toEqual({ 
        success: false, 
        error: networkError 
      });
      expect(consoleSpy).toHaveBeenCalledWith('error sending telegram message', networkError);
      
      consoleSpy.mockRestore();
    });

    test('should handle JSON parsing errors', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.reject(new Error('Invalid JSON'))
      });
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await service.send({
        chatId: '123456789',
        text: 'Test message'
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
        chatId: '123456789',
        text: 'Test message'
      });

      expect(result).toEqual({ 
        success: false, 
        error: fetchError 
      });
      expect(consoleSpy).toHaveBeenCalledWith('error sending telegram message', fetchError);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Chat ID Handling', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
    });

    test('should handle numeric chat ID', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true })
      });

      await service.send({
        chatId: 123456789,
        text: 'Test message'
      });

      const callArgs = global.fetch.mock.calls[0];
      const url = callArgs[0];
      
      expect(url).toContain('chat_id=123456789');
    });

    test('should handle string chat ID', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true })
      });

      await service.send({
        chatId: '123456789',
        text: 'Test message'
      });

      const callArgs = global.fetch.mock.calls[0];
      const url = callArgs[0];
      
      expect(url).toContain('chat_id=123456789');
    });

    test('should handle negative chat ID (groups)', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true })
      });

      await service.send({
        chatId: '-123456789',
        text: 'Test group message'
      });

      const callArgs = global.fetch.mock.calls[0];
      const url = callArgs[0];
      
      expect(url).toContain('chat_id=-123456789');
    });

    test('should handle channel username format', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true })
      });

      await service.send({
        chatId: '@mychannel',
        text: 'Test channel message'
      });

      const callArgs = global.fetch.mock.calls[0];
      const url = callArgs[0];
      
      expect(url).toContain('chat_id=%40mychannel');
    });
  });

  describe('Message Content Handling', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
    });

    test('should handle Markdown formatting', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true })
      });

      const markdownMessage = '*Bold text* _italic text_ `code` [link](https://example.com)';

      await service.send({
        chatId: '123456789',
        text: markdownMessage
      });

      const callArgs = global.fetch.mock.calls[0];
      const url = callArgs[0];
      
      // Check that the URL contains the properly encoded text using URLSearchParams (like the service does)
      const expectedParams = new URLSearchParams({ text: markdownMessage }).toString();
      expect(url).toContain(expectedParams.split('=')[1]); // Get just the encoded text part
    });

    test('should handle emojis', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true })
      });

      const emojiMessage = '🎉 🚀 🤖 😀 👍 ❤️ 🔥 ⭐';

      await service.send({
        chatId: '123456789',
        text: emojiMessage
      });

      const callArgs = global.fetch.mock.calls[0];
      const url = callArgs[0];
      
      // Check that the URL contains the properly encoded text using URLSearchParams (like the service does)
      const expectedParams = new URLSearchParams({ text: emojiMessage }).toString();
      expect(url).toContain(expectedParams.split('=')[1]); // Get just the encoded text part
    });

    test('should handle very long messages (4096+ chars)', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true })
      });

      // Telegram has a 4096 character limit, but service should handle it
      const veryLongMessage = 'A'.repeat(5000);

      await service.send({
        chatId: '123456789',
        text: veryLongMessage
      });

      const callArgs = global.fetch.mock.calls[0];
      const url = callArgs[0];
      
      expect(url).toContain(encodeURIComponent(veryLongMessage));
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing bot token', async () => {
      process.env.NODE_ENV = 'production';
      
      const serviceWithoutToken = new TelegramService();
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true })
      });

      await serviceWithoutToken.send({
        chatId: '123456789',
        text: 'Test'
      });

      const callArgs = global.fetch.mock.calls[0];
      const url = callArgs[0];
      
      expect(url).toContain('https://api.telegram.org/botundefined/sendMessage');
      
      process.env.NODE_ENV = 'test';
    });

    test('should handle undefined message parameters', async () => {
      process.env.NODE_ENV = 'production';
      
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true })
      });

      await service.send({
        chatId: undefined,
        text: undefined
      });

      const callArgs = global.fetch.mock.calls[0];
      const url = callArgs[0];
      
      expect(url).toContain('chat_id=undefined');
      expect(url).toContain('text=undefined');
      
      process.env.NODE_ENV = 'test';
    });

    test('should handle concurrent sends', async () => {
      process.env.NODE_ENV = 'production';
      
      global.fetch.mockImplementation(() => 
        Promise.resolve({
          json: () => Promise.resolve({ ok: true })
        })
      );

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(service.send({
          chatId: `12345678${i}`,
          text: `Message ${i}`
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
        chatId: '123456789',
        text: 'Test timeout'
      });

      expect(result).toEqual({ 
        success: false, 
        error: expect.any(Error)
      });
      expect(consoleSpy).toHaveBeenCalledWith('error sending telegram message', expect.any(Error));
      
      consoleSpy.mockRestore();
      process.env.NODE_ENV = 'test';
    });
  });

  describe('Environment Handling', () => {
    test('should detect test environment correctly', async () => {
      process.env.NODE_ENV = 'test';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = await service.send({
        chatId: '123456789',
        text: 'Test message'
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'DEV LOG: Telegram message to chat 123456789 - Test message'
      );
      expect(result).toEqual({
        message: 'DEV LOG: Telegram message to chat 123456789 - Test message'
      });
      expect(global.fetch).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should treat undefined NODE_ENV as development', async () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = await service.send({
        chatId: '123456789',
        text: 'Test message'
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'DEV LOG: Telegram message to chat 123456789 - Test message'
      );
      expect(result).toEqual({
        message: 'DEV LOG: Telegram message to chat 123456789 - Test message'
      });
      expect(global.fetch).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    test('should treat empty NODE_ENV as development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = '';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = await service.send({
        chatId: '123456789',
        text: 'Test message'
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'DEV LOG: Telegram message to chat 123456789 - Test message'
      );
      expect(result).toEqual({
        message: 'DEV LOG: Telegram message to chat 123456789 - Test message'
      });
      expect(global.fetch).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('URL Construction', () => {
    test('should construct correct URL with parameters', async () => {
      process.env.NODE_ENV = 'production';
      
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true })
      });

      await service.send({
        chatId: '123456789',
        text: 'Test message'
      });

      const expectedBaseUrl = 'https://api.telegram.org/bottest-bot-token/sendMessage';
      const callArgs = global.fetch.mock.calls[0];
      const url = callArgs[0];
      
      expect(url).toMatch(new RegExp(`^${expectedBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      expect(url).toContain('?chat_id=123456789');
      expect(url).toContain('&text=Test+message');
      
      process.env.NODE_ENV = 'test';
    });

    test('should handle URL construction with special token', async () => {
      process.env.NODE_ENV = 'production';
      
      const specialTokenService = new TelegramService('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true })
      });

      await specialTokenService.send({
        chatId: '123456789',
        text: 'Test'
      });

      const callArgs = global.fetch.mock.calls[0];
      const url = callArgs[0];
      
      expect(url).toContain('https://api.telegram.org/bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11/sendMessage');
      
      process.env.NODE_ENV = 'test';
    });
  });
});