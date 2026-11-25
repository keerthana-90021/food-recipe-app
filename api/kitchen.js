import { createKitchenHandler } from '../server/kitchen.js';
import { RedisRepository } from '../server/redis.js';

let kitchen;
export default async function handler(req,res) {
  if(!kitchen) {
    try {
      kitchen=createKitchenHandler({
        repository:new RedisRepository(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
          process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN),
        adminEmail:process.env.SUPPERCLUB_ADMIN_EMAIL,adminPassword:process.env.SUPPERCLUB_ADMIN_PASSWORD
      });
    } catch {
      res.statusCode=503;
      res.setHeader('Cache-Control','no-store');
      res.setHeader('Content-Type','application/json; charset=utf-8');
      return res.end(JSON.stringify({error:'The shared kitchen needs its database and administrator settings.'}));
    }
  }
  return kitchen(req,res);
}
