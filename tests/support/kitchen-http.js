import {randomBytes, randomUUID} from 'node:crypto';
import http from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createKitchenHandler} from '../../server/kitchen.js';
import {MemoryRepository} from '../../server/memory.js';

// A local socket keeps the integration test independent of network access.
// Requests still use Node's real HTTP parser, headers, cookies and response stream.
export async function openTestKitchen() {
  const origin = 'https://supperclub.test';
  const socketPath = process.platform === 'win32'
    ? '\\\\.\\pipe\\supperclub-' + randomUUID()
    : join(tmpdir(), 'supperclub-' + randomUUID() + '.sock');
  const adminEmail = 'qa-admin@example.test';
  const adminPassword = randomBytes(32).toString('hex');
  const server = http.createServer(createKitchenHandler({
    repository: new MemoryRepository(), adminEmail, adminPassword, secureCookie: true
  }));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, resolve);
  });

  function request({path = '/api/kitchen', method = 'GET', headers = {}, body} = {}) {
    return new Promise((resolve, reject) => {
      const outgoing = http.request({
        socketPath, path, method, agent: false,
        headers: {host: new URL(origin).host, 'x-forwarded-proto': 'https', ...headers}
      }, incoming => {
        const chunks = [];
        incoming.on('data', chunk => chunks.push(chunk));
        incoming.on('error', reject);
        incoming.on('end', () => resolve({
          status: incoming.statusCode, headers: incoming.headers, body: Buffer.concat(chunks)
        }));
      });
      outgoing.on('error', reject);
      outgoing.end(body);
    });
  }

  return {
    origin, adminEmail, adminPassword, request,
    close: () => new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()))
  };
}
