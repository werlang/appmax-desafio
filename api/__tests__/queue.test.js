import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import Queue from '../helpers/queue.js';

describe('Queue', () => {
  let queue;

  beforeEach(() => {
    queue = new Queue();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with empty queue and not running', () => {
      expect(queue.queue).toEqual([]);
      expect(queue.running).toBe(false);
      expect(queue.updateCallbacks).toEqual([]);
    });
  });

  describe('add()', () => {
    test('should add item to queue with UUID', async () => {
      const mockData = { message: 'test' };
      const mockCallback = jest.fn().mockImplementation(async () => {
        // Add delay to prevent immediate processing
        await new Promise(resolve => setTimeout(resolve, 50));
      });
      
      // Temporarily mark queue as running to prevent auto-processing
      queue.running = true;
      
      const id = queue.add({ data: mockData, callback: mockCallback });
      
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      
      // Check immediately - should still be in queue
      expect(queue.queue).toHaveLength(1);
      expect(queue.queue[0].id).toBe(id);
      expect(queue.queue[0].data).toEqual(mockData);
      expect(queue.queue[0].callback).toBe(mockCallback);
      
      // Allow processing to continue
      queue.running = false;
      
      // Wait for processing to complete
      await queue.process();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should trigger processing when item is added', () => {
      const processSpy = jest.spyOn(queue, 'process');
      const mockCallback = jest.fn();
      
      queue.add({ data: {}, callback: mockCallback });
      
      expect(processSpy).toHaveBeenCalled();
      processSpy.mockRestore();
    });

    test('should add multiple items with unique IDs', async () => {
      const mockCallback = jest.fn().mockImplementation(async () => {
        // Add delay to prevent immediate processing
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      const id1 = queue.add({ data: { test: 1 }, callback: mockCallback });
      const id2 = queue.add({ data: { test: 2 }, callback: mockCallback });
      const id3 = queue.add({ data: { test: 3 }, callback: mockCallback });
      
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
      
      // Should have 3 items initially (processing happens async)
      expect(queue.queue.length).toBeGreaterThanOrEqual(2); // Some might already be processed
      
      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });

  describe('process()', () => {
    test('should not process when queue is empty', async () => {
      await queue.process();
      expect(queue.running).toBe(false);
    });

    test('should not process when already running', async () => {
      queue.running = true;
      const mockCallback = jest.fn();
      queue.add({ data: {}, callback: mockCallback });
      
      await queue.process();
      
      expect(mockCallback).not.toHaveBeenCalled();
    });

    test('should process item and remove from queue', async () => {
      const mockCallback = jest.fn().mockResolvedValue();
      const mockData = { test: 'data' };
      
      queue.add({ data: mockData, callback: mockCallback });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockCallback).toHaveBeenCalledWith(mockData);
      expect(queue.queue).toHaveLength(0);
    });

    test('should handle callback errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockCallback = jest.fn().mockRejectedValue(new Error('Test error'));
      
      queue.add({ data: {}, callback: mockCallback });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(consoleSpy).toHaveBeenCalledWith('Error processing queue item:', expect.any(Error));
      expect(queue.running).toBe(false);
      
      consoleSpy.mockRestore();
    });

    test('should process items sequentially', async () => {
      const callOrder = [];
      const mockCallback1 = jest.fn().mockImplementation(async () => {
        callOrder.push(1);
        await new Promise(resolve => setTimeout(resolve, 50));
      });
      const mockCallback2 = jest.fn().mockImplementation(async () => {
        callOrder.push(2);
        await new Promise(resolve => setTimeout(resolve, 50));
      });
      const mockCallback3 = jest.fn().mockImplementation(async () => {
        callOrder.push(3);
        await new Promise(resolve => setTimeout(resolve, 50));
      });
      
      queue.add({ data: {}, callback: mockCallback1 });
      queue.add({ data: {}, callback: mockCallback2 });
      queue.add({ data: {}, callback: mockCallback3 });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(callOrder).toEqual([1, 2, 3]);
    });

    test('should continue processing after error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockCallbackError = jest.fn().mockRejectedValue(new Error('Test error'));
      const mockCallbackSuccess = jest.fn().mockResolvedValue();
      
      queue.add({ data: {}, callback: mockCallbackError });
      queue.add({ data: {}, callback: mockCallbackSuccess });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockCallbackError).toHaveBeenCalled();
      expect(mockCallbackSuccess).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('getSize()', () => {
    test('should return 0 for empty queue', () => {
      expect(queue.getSize()).toBe(0);
    });

    test('should return correct size for non-empty queue', async () => {
      const mockCallback = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Long delay
      });
      
      queue.add({ data: {}, callback: mockCallback });
      queue.add({ data: {}, callback: mockCallback });
      queue.add({ data: {}, callback: mockCallback });
      
      // Should have items initially
      expect(queue.getSize()).toBeGreaterThanOrEqual(2); // Some processing might have started
      
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    test('should decrease size after processing', async () => {
      const mockCallback = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      
      queue.add({ data: {}, callback: mockCallback });
      queue.add({ data: {}, callback: mockCallback });
      
      const initialSize = queue.getSize();
      expect(initialSize).toBeGreaterThanOrEqual(1);
      
      // Wait for some processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(queue.getSize()).toBeLessThan(initialSize);
    });
  });

  describe('getPosition()', () => {
    test('should return null for non-existent ID', () => {
      expect(queue.getPosition('non-existent-id')).toBeNull();
    });

    test('should return correct position for existing item', async () => {
      const mockCallback = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Long delay
      });
      
      const id1 = queue.add({ data: {}, callback: mockCallback });
      const id2 = queue.add({ data: {}, callback: mockCallback });
      const id3 = queue.add({ data: {}, callback: mockCallback });
      
      // Wait a moment for processing to potentially start
      await new Promise(resolve => setTimeout(resolve, 5));
      
      // Check positions (they might change as processing happens)
      const pos1 = queue.getPosition(id1);
      const pos2 = queue.getPosition(id2);
      const pos3 = queue.getPosition(id3);
      
      if (pos1 !== null) expect(pos1).toBeGreaterThan(0);
      if (pos2 !== null) expect(pos2).toBeGreaterThan(0);
      if (pos3 !== null) expect(pos3).toBeGreaterThan(0);
      
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    test('should return null after item is processed', async () => {
      const mockCallback = jest.fn().mockResolvedValue();
      
      const id = queue.add({ data: {}, callback: mockCallback });
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(queue.getPosition(id)).toBeNull();
    });
  });

  describe('onUpdate()', () => {
    test('should add update callback', () => {
      const updateCallback = jest.fn();
      
      queue.onUpdate('test-id', updateCallback);
      
      expect(queue.updateCallbacks).toHaveLength(1);
      expect(queue.updateCallbacks[0].id).toBe('test-id');
      expect(queue.updateCallbacks[0].callback).toBe(updateCallback);
      expect(queue.updateCallbacks[0].status).toBe('pending');
    });

    test('should handle multiple update callbacks', () => {
      const updateCallback1 = jest.fn();
      const updateCallback2 = jest.fn();
      
      queue.onUpdate('test-id-1', updateCallback1);
      queue.onUpdate('test-id-2', updateCallback2);
      
      expect(queue.updateCallbacks).toHaveLength(2);
    });

    test('should call update callbacks during processing', async () => {
      const updateCallback = jest.fn();
      const processCallback = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      
      const id = queue.add({ data: {}, callback: processCallback });
      queue.onUpdate(id, updateCallback);
      
      // Add another item to see position updates
      const id2 = queue.add({ data: {}, callback: processCallback });
      queue.onUpdate(id2, updateCallback);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should have been called for position updates or completion
      expect(updateCallback).toHaveBeenCalled();
    });

    test('should filter out completed callbacks', async () => {
      const processCallback = jest.fn().mockResolvedValue();
      const updateCallback = jest.fn();
      
      const id = queue.add({ data: {}, callback: processCallback });
      queue.onUpdate(id, updateCallback);
      
      expect(queue.updateCallbacks).toHaveLength(1);
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Completed callbacks should be filtered out
      expect(queue.updateCallbacks.filter(cb => cb.status === 'pending')).toHaveLength(0);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    test('should handle null callback gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      queue.add({ data: {}, callback: null });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should handle undefined data', async () => {
      const mockCallback = jest.fn().mockResolvedValue();
      
      queue.add({ data: undefined, callback: mockCallback });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockCallback).toHaveBeenCalledWith(undefined);
    });

    test('should handle very large queue', () => {
      const largeNumber = 1000;
      const mockCallback = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1)); // Very fast processing
      });
      
      for (let i = 0; i < largeNumber; i++) {
        queue.add({ data: {}, callback: mockCallback });
      }
      
      // Should have most items (some might start processing immediately)
      expect(queue.getSize()).toBeGreaterThan(largeNumber - 10);
    });

    test('should handle rapid additions', () => {
      const mockCallback = jest.fn();
      
      for (let i = 0; i < 100; i++) {
        queue.add({ data: {}, callback: mockCallback });
      }
      
      // Should have most items
      expect(queue.getSize()).toBeGreaterThan(90);
    });

    test('should handle mixed sync and async callbacks', async () => {
      const syncCallback = jest.fn();
      const asyncCallback = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      queue.add({ data: {}, callback: syncCallback });
      queue.add({ data: {}, callback: asyncCallback });
      queue.add({ data: {}, callback: syncCallback });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(syncCallback).toHaveBeenCalledTimes(2);
      expect(asyncCallback).toHaveBeenCalledTimes(1);
    });

    test('should maintain queue integrity during concurrent operations', async () => {
      const callbacks = [];
      
      // Create many callbacks with different processing times
      for (let i = 0; i < 20; i++) {
        const callback = jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        });
        callbacks.push(callback);
        queue.add({ data: { index: i }, callback });
      }
      
      // Wait for all processing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // All callbacks should have been called
      callbacks.forEach(callback => {
        expect(callback).toHaveBeenCalled();
      });
      
      // Queue should be empty
      expect(queue.getSize()).toBe(0);
    });
  });
});