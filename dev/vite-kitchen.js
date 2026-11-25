import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv } from 'vite';
import { createDevRepository } from './repository.js';

export function localKitchen() {
  let config;
  async function install(server) {
    const env = loadEnv(config.mode, config.root, 'SUPPERCLUB_DEV_');
    const adminEmail = env.SUPPERCLUB_DEV_ADMIN_EMAIL?.trim();
    const adminPassword = env.SUPPERCLUB_DEV_ADMIN_PASSWORD;
    if (Boolean(adminEmail) !== Boolean(adminPassword) || (adminPassword && adminPassword.length < 15)) {
      throw new Error('Set both SUPPERCLUB_DEV_ADMIN_EMAIL and a SUPPERCLUB_DEV_ADMIN_PASSWORD of at least 15 characters in .env.local.');
    }
    const { createKitchenHandler } = await import(pathToFileURL(resolve(config.root, 'server/kitchen.js')).href);
    const handler = createKitchenHandler({
      repository: createDevRepository(resolve(config.root, '.kitchen-dev')),
      adminEmail: adminEmail || 'unconfigured-admin@localhost.invalid',
      adminPassword: adminPassword || randomBytes(32).toString('hex'),
      secureCookie: Boolean(config.server.https)
    });
    server.middlewares.use((req, res, next) => {
      const endpoint = req.url?.split('?')[0];
      if (endpoint !== '/api/kitchen') return next();
      Promise.resolve(handler(req, res)).catch(next);
    });
  }
  return { name: 'local-kitchen', configResolved(value) { config = value; },
    configureServer: install, configurePreviewServer: install };
}
