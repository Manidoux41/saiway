import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
import nextEnv from '@next/env';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

nextEnv.loadEnvConfig(fileURLToPath(new URL('../', import.meta.url)));
const base = process.env.VALIDATION_URL || 'http://localhost:3000';

async function request(path, method = 'GET', body, cookie) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

async function setup() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL }) });
  const prefix = `validation-${randomUUID()}`;
  const email = `${prefix}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  const hash = `scrypt$16384$8$1$${salt}$${scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('base64')}`;
  let user;
  try {
    user = await prisma.user.create({ data: { name: prefix, email, passwordHash: hash, role: 'ADMIN', administrator: { create: {} } } });
    const login = await request('/api/auth/login', 'POST', { email, password });
    assert.equal(login.status, 200);
    assert.equal(login.data.user.role, 'admin');
    assert.ok(login.cookie);
    return { prisma, prefix, email, password, cookie: login.cookie, cleanup: async () => {
      try { await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } }); }
      finally { await prisma.$disconnect(); }
    } };
  } catch (error) {
    try { if (user) await prisma.user.delete({ where: { id: user.id } }); }
    finally { await prisma.$disconnect(); }
    throw error;
  }
}

export { assert, request, setup };
