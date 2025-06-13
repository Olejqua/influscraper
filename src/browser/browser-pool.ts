import { chromium, type Browser, type BrowserContext, type LaunchOptions } from 'playwright';

import { config } from '../config';
import logger from '../utils/logger';

interface BrowserInstance {
  browser: Browser;
  context: BrowserContext;
  createdAt: number;
  lastUsed: number;
  isActive: boolean;
  id: string;
}

/**
 * Browser pool for reuse and resource optimization
 */
class BrowserPool {
  private instances: Map<string, BrowserInstance> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor() {
    // Periodic cleanup of inactive browsers
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleInstances();
    }, 60000); // every minute
  }

  /**
   * Gets browser context from pool or creates a new one
   */
  async getBrowserContext(proxy?: string): Promise<{ context: BrowserContext; instanceId: string }> {
    if (this.isShuttingDown) {
      throw new Error('Browser pool is shutting down');
    }

    // Look for available browser
    const availableInstance = this.findAvailableInstance(proxy);
    if (availableInstance) {
      availableInstance.lastUsed = Date.now();
      availableInstance.isActive = true;

      logger.debug('Browser pool: reusing existing instance', {
        instanceId: availableInstance.id,
        totalInstances: this.instances.size,
      });

      return {
        context: availableInstance.context,
        instanceId: availableInstance.id,
      };
    }

    // Create new browser if pool is not full
    if (this.instances.size < config.browser.poolSize) {
      const instance = await this.createBrowserInstance(proxy);

      logger.info('Browser pool: created new instance', {
        instanceId: instance.id,
        totalInstances: this.instances.size,
        poolSize: config.browser.poolSize,
      });

      return {
        context: instance.context,
        instanceId: instance.id,
      };
    }

    // If pool is full, wait for browser to be released
    logger.warn('Browser pool: pool is full, waiting for available instance', {
      poolSize: config.browser.poolSize,
      activeInstances: Array.from(this.instances.values()).filter(i => i.isActive).length,
    });

    return this.waitForAvailableInstance(proxy);
  }

  /**
   * Releases browser context
   */
  async releaseBrowserContext(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      logger.warn('Browser pool: attempted to release unknown instance', {
        instanceId,
      });
      return;
    }

    instance.isActive = false;
    instance.lastUsed = Date.now();

    logger.debug('Browser pool: released instance', {
      instanceId,
      activeInstances: Array.from(this.instances.values()).filter(i => i.isActive).length,
    });
  }

  /**
   * Creates a new browser instance
   */
  private async createBrowserInstance(_proxy?: string): Promise<BrowserInstance> {
    const instanceId = Math.random().toString(36).substring(7);
    const startTime = Date.now();

    try {
      const launchOptions: LaunchOptions = {
        headless: true,
        timeout: config.browser.launchTimeout,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
        ],
      };

      if (_proxy) {
        launchOptions.proxy = { server: _proxy };
      }

      const browser = await chromium.launch(launchOptions);
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        ignoreHTTPSErrors: true,
      });

      const instance: BrowserInstance = {
        browser,
        context,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isActive: true,
        id: instanceId,
      };

      this.instances.set(instanceId, instance);

      const duration = Date.now() - startTime;
      logger.info('Browser pool: instance created successfully', {
        instanceId,
        duration,
        proxy: !!_proxy,
      });

      return instance;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Browser pool: failed to create instance', {
        instanceId,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Finds an available browser instance
   */
  private findAvailableInstance(_proxy?: string): BrowserInstance | null {
    for (const instance of this.instances.values()) {
      if (!instance.isActive) {
        // Check proxy compatibility (simplified check)
        return instance;
      }
    }
    return null;
  }

  /**
   * Waits for a browser instance to be released
   */
  private async waitForAvailableInstance(_proxy?: string): Promise<{ context: BrowserContext; instanceId: string }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for available browser instance'));
      }, 30000); // 30 seconds timeout

      const checkInterval = setInterval(() => {
        const available = this.findAvailableInstance(_proxy);
        if (available) {
          clearTimeout(timeout);
          clearInterval(checkInterval);

          available.lastUsed = Date.now();
          available.isActive = true;

          resolve({
            context: available.context,
            instanceId: available.id,
          });
        }
      }, 100); // check every 100ms
    });
  }

  /**
   * Cleans up inactive browser instances
   */
  private async cleanupIdleInstances(): Promise<void> {
    const now = Date.now();
    const instancesToCleanup: string[] = [];

    for (const [id, instance] of this.instances.entries()) {
      const idleTime = now - instance.lastUsed;

      if (!instance.isActive && idleTime > config.browser.idleTimeout) {
        instancesToCleanup.push(id);
      }
    }

    if (instancesToCleanup.length > 0) {
      logger.info('Browser pool: cleaning up idle instances', {
        count: instancesToCleanup.length,
        totalInstances: this.instances.size,
      });

      for (const id of instancesToCleanup) {
        await this.closeBrowserInstance(id);
      }
    }
  }

  /**
   * Closes a browser instance
   */
  private async closeBrowserInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    try {
      await instance.context.close();
      await instance.browser.close();
      this.instances.delete(instanceId);

      logger.debug('Browser pool: instance closed', {
        instanceId,
        remainingInstances: this.instances.size,
      });
    } catch (error) {
      logger.error('Browser pool: error closing instance', {
        instanceId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Force remove from pool even on error
      this.instances.delete(instanceId);
    }
  }

  /**
   * Returns browser pool statistics
   */
  getStats() {
    const instances = Array.from(this.instances.values());
    const now = Date.now();

    return {
      totalInstances: instances.length,
      activeInstances: instances.filter(i => i.isActive).length,
      idleInstances: instances.filter(i => !i.isActive).length,
      oldestInstance: instances.length > 0 ? Math.min(...instances.map(i => now - i.createdAt)) : 0,
      poolSize: config.browser.poolSize,
      isShuttingDown: this.isShuttingDown,
    };
  }

  /**
   * Graceful shutdown of browser pool
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    clearInterval(this.cleanupInterval);

    logger.info('Browser pool: starting shutdown', {
      totalInstances: this.instances.size,
    });

    const shutdownPromises = Array.from(this.instances.keys()).map(id => this.closeBrowserInstance(id));

    await Promise.allSettled(shutdownPromises);

    logger.info('Browser pool: shutdown complete');
  }
}

// Global singleton browser pool instance
export const browserPool = new BrowserPool();

/**
 * Helper for executing tasks with browser context
 */
export async function withBrowserContext<T>(task: (context: BrowserContext) => Promise<T>, proxy?: string): Promise<T> {
  const { context, instanceId } = await browserPool.getBrowserContext(proxy);

  try {
    return await task(context);
  } finally {
    await browserPool.releaseBrowserContext(instanceId);
  }
}
