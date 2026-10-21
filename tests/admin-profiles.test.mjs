import { test } from 'node:test';
import { assert, request, setup, createAccount, base } from './helpers.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const employerKeys = ['name', 'registrationNo', 'address', 'representative', 'representativeTitle'].map((key) => `employer.${key}`);
const contract = { position: 'Driver', workplace: 'Siem Reap', startsAt: '2026-11-01', probationMonths: 2, hoursPerWeek: 48, monthlySalaryCents: 35000, annualLeaveDays: 18, additionalTerms: 'Uniform provided.' };

async function withEmployerRestored(ctx, run) {
  const saved = await ctx.prisma.systemSetting.findMany({ where: { key: { in: employerKeys } } });
  try { await run(); }
  finally {
    await ctx.prisma.systemSetting.deleteMany({ where: { key: { in: employerKeys } } });
    for (const row of saved) await ctx.prisma.systemSetting.create({ data: { key: row.key, value: row.value } });
  }
}

async function upload(cookie, driverId, side, method = 'PUT') {
  const body = new FormData();
  body.set('file', new Blob([png], { type: 'image/png' }), 'licence.png');
  const response = await fetch(`${base}/api/drivers/${driverId}/license/${side}`, { method, body: method === 'PUT' ? body : undefined, signal: AbortSignal.timeout(30_000), headers: cookie ? { Cookie: cookie } : {} });
  return { status: response.status, data: await response.json() };
}

test('only administrators can read and edit account profiles', async () => {
  const ctx = await setup();
  try {
    const driver = await createAccount(ctx, 'DRIVER', 'driver');
    const customer = await createAccount(ctx, 'CUSTOMER', 'customer');
    for (const cookie of [undefined, driver.cookie, customer.cookie]) {
      assert.equal((await request(`/api/admin/accounts/${customer.id}`, 'GET', undefined, cookie)).status, 403);
      assert.equal((await request(`/api/admin/accounts/${customer.id}`, 'PATCH', { name: 'Hacked' }, cookie)).status, 403);
      assert.equal((await request('/api/admin/employer', 'GET', undefined, cookie)).status, 403);
      assert.equal((await request('/api/admin/employer', 'PUT', { name: 'Hacked' }, cookie)).status, 403);
    }
    const driverId = (await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } })).id;
    assert.equal((await upload(customer.cookie, driverId, 'FRONT')).status, 403);
    assert.equal((await request(`/api/admin/drivers/${driverId}/contracts`, 'POST', contract, driver.cookie)).status, 403);
    assert.equal((await ctx.prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).name, `${ctx.prefix}-customer`);
    assert.equal((await request(`/api/admin/accounts/${ctx.id}`, 'PATCH', { name: 'Self edit' }, ctx.cookie)).status, 409);
    assert.equal((await request('/api/admin/accounts/unknown-user', 'GET', undefined, ctx.cookie)).status, 404);
  } finally { await ctx.cleanup(); }
});

test('administrators complete, clear and archive customer profiles', async () => {
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, 'CUSTOMER', 'customer');
    const path = `/api/admin/accounts/${customer.id}`;
    const updated = await request(path, 'PATCH', { phone: '+855 12 345 678', customer: { address: 'Wat Bo Road', nationality: 'French', preferredLanguage: 'fr', company: 'Hotel Angkor', adminNotes: 'VIP' } }, ctx.cookie);
    assert.equal(updated.status, 200);
    assert.equal(updated.data.account.phone, '+855 12 345 678');
    assert.deepEqual(updated.data.account.customer, { address: 'Wat Bo Road', nationality: 'French', preferredLanguage: 'fr', company: 'Hotel Angkor', adminNotes: 'VIP' });

    const cleared = await request(path, 'PATCH', { phone: '', customer: { company: '', adminNotes: null } }, ctx.cookie);
    assert.equal(cleared.status, 200);
    const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { id: customer.id }, include: { customer: true } });
    assert.equal(stored.phone, null);
    assert.equal(stored.customer.company, null);
    assert.equal(stored.customer.adminNotes, null);
    assert.equal(stored.customer.nationality, 'French');

    assert.equal((await request(path, 'PATCH', { driver: { licenseNo: 'X' } }, ctx.cookie)).status, 400);
    assert.equal((await request(path, 'PATCH', { role: 'ADMIN' }, ctx.cookie)).status, 400);
    assert.equal((await request(path, 'PATCH', { email: ctx.email }, ctx.cookie)).status, 409);

    assert.equal((await request(path, 'PATCH', { status: 'SUSPENDED' }, ctx.cookie)).status, 200);
    assert.equal((await request('/api/auth/session', 'POST', undefined, customer.cookie)).status, 403);
    assert.equal((await request('/api/auth/login', 'POST', { email: customer.email, password: ctx.password })).status, 401);
    assert.equal(await ctx.prisma.user.count({ where: { id: customer.id } }), 1);
    assert.equal((await request(path, 'PATCH', { status: 'ACTIVE' }, ctx.cookie)).status, 200);
    assert.equal((await request('/api/auth/login', 'POST', { email: customer.email, password: ctx.password })).status, 200);
    assert.ok(await ctx.prisma.auditLog.count({ where: { actorId: ctx.id, entity: 'user', entityId: customer.id, action: 'UPDATE_PROFILE' } }) >= 4);
  } finally { await ctx.cleanup(); }
});

test('administrators manage driver details, licence photos and employment contracts', async () => {
  const ctx = await setup();
  try {
    await withEmployerRestored(ctx, async () => {
      const driver = await createAccount(ctx, 'DRIVER', 'driver');
      const driverId = (await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } })).id;
      await ctx.prisma.systemSetting.deleteMany({ where: { key: { in: employerKeys } } });

      const created = await request(`/api/admin/drivers/${driverId}/contracts`, 'POST', contract, ctx.cookie);
      assert.equal(created.status, 201);
      assert.match(created.data.contract.reference, /^EC-\d{4}-[0-9A-F]{8}$/);
      assert.equal(created.data.contract.status, 'DRAFT');
      const contractPath = `/api/admin/contracts/${created.data.contract.id}`;
      assert.equal((await request(`/api/admin/drivers/${driverId}/contracts`, 'POST', { ...contract, hoursPerWeek: 60 }, ctx.cookie)).status, 400);
      assert.equal((await request(`/api/admin/drivers/${driverId}/contracts`, 'POST', { ...contract, startsAt: '2026-02-30' }, ctx.cookie)).status, 400);

      const blocked = await request(contractPath, 'PATCH', { action: 'activate' }, ctx.cookie);
      assert.equal(blocked.status, 409);
      for (const key of ['employerName', 'employerAddress', 'employerRepresentative', 'dateOfBirth', 'nationality', 'idDocumentNo', 'address', 'phone', 'licenseNo', 'licenseExpiresAt']) assert.ok(blocked.data.missing.includes(key), key);

      const employer = await request('/api/admin/employer', 'PUT', { name: 'SAIWAY Co., Ltd', registrationNo: '00012345', address: 'Siem Reap', representative: 'Test Director', representativeTitle: 'Director' }, ctx.cookie);
      assert.equal(employer.status, 200);
      assert.equal(employer.data.employer.representative, 'Test Director');
      assert.equal((await request('/api/admin/employer', 'PUT', { registrationNo: '' }, ctx.cookie)).data.employer.registrationNo, null);

      const path = `/api/admin/accounts/${driver.id}`;
      const details = { dateOfBirth: '1990-04-15', nationality: 'Cambodian', idDocumentNo: '010203040', address: 'Svay Dangkum, Siem Reap', emergencyContactName: 'Dara', emergencyContactPhone: '+855 11 222 333', licenseNo: 'KH-123456', licenseCategory: 'B', licenseExpiresAt: '2020-01-01', adminNotes: 'Night shifts' };
      assert.equal((await request(path, 'PATCH', { customer: { company: 'X' } }, ctx.cookie)).status, 400);
      assert.equal((await request(path, 'PATCH', { driver: { dateOfBirth: '1990-13-01' } }, ctx.cookie)).status, 400);
      const saved = await request(path, 'PATCH', { phone: '+855 12 345 678', driver: details }, ctx.cookie);
      assert.equal(saved.status, 200);
      assert.deepEqual(saved.data.account.contractReadiness, ['licenseExpired']);
      assert.equal((await request(contractPath, 'PATCH', { action: 'activate' }, ctx.cookie)).data.missing[0], 'licenseExpired');
      const ready = await request(path, 'PATCH', { driver: { licenseExpiresAt: '2035-05-31', emergencyContactName: '' } }, ctx.cookie);
      assert.deepEqual(ready.data.account.contractReadiness, []);
      assert.equal(ready.data.account.driver.emergencyContactName, null);
      assert.equal(ready.data.account.driver.licenseExpiresAt.slice(0, 10), '2035-05-31');

      assert.equal((await upload(ctx.cookie, driverId, 'FRONT')).status, 201);
      assert.equal((await upload(ctx.cookie, 'unknown-driver', 'FRONT')).status, 404);
      const own = await fetch(`${base}/api/drivers/${driverId}/license/FRONT`, { headers: { Cookie: driver.cookie } });
      assert.equal(own.status, 200);
      assert.ok(Buffer.from(await own.arrayBuffer()).equals(png));
      assert.equal((await upload(driver.cookie, driverId, 'FRONT', 'DELETE')).status, 403);
      assert.equal((await upload(ctx.cookie, driverId, 'FRONT', 'DELETE')).status, 200);
      assert.equal((await upload(ctx.cookie, driverId, 'FRONT', 'DELETE')).status, 404);
      assert.equal(await ctx.prisma.driverLicenseImage.count({ where: { driverId } }), 0);
      assert.equal(await ctx.prisma.auditLog.count({ where: { actorId: ctx.id, entity: 'DriverLicenseImage', action: { in: ['UPLOAD_FRONT', 'DELETE_FRONT'] } } }), 2);

      const edited = await request(contractPath, 'PATCH', { action: 'update', data: { monthlySalaryCents: 42050, probationMonths: 1 } }, ctx.cookie);
      assert.equal(edited.status, 200);
      assert.equal(edited.data.contract.monthlySalaryCents, 42050);
      const draftPdf = await fetch(`${base}${contractPath}/pdf`, { headers: { Cookie: ctx.cookie } });
      assert.equal(draftPdf.status, 200);
      assert.equal(draftPdf.headers.get('content-type'), 'application/pdf');
      assert.match(draftPdf.headers.get('content-disposition'), /attachment; filename="EC-\d{4}-[0-9A-F]{8}\.pdf"/);
      const bytes = Buffer.from(await draftPdf.arrayBuffer());
      assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
      assert.ok(bytes.length > 10_000);
      assert.equal((await fetch(`${base}${contractPath}/pdf`, { headers: { Cookie: driver.cookie } })).status, 403);

      const activated = await request(contractPath, 'PATCH', { action: 'activate' }, ctx.cookie);
      assert.equal(activated.status, 200);
      assert.equal(activated.data.contract.status, 'ACTIVE');
      assert.ok(activated.data.contract.activatedAt);
      assert.equal((await request(contractPath, 'PATCH', { action: 'update', data: { monthlySalaryCents: 1 } }, ctx.cookie)).status, 409);
      assert.equal((await request(contractPath, 'DELETE', undefined, ctx.cookie)).status, 409);

      const second = await request(`/api/admin/drivers/${driverId}/contracts`, 'POST', contract, ctx.cookie);
      const secondPath = `/api/admin/contracts/${second.data.contract.id}`;
      const duplicate = await request(secondPath, 'PATCH', { action: 'activate' }, ctx.cookie);
      assert.equal(duplicate.status, 409);
      assert.deepEqual(duplicate.data.missing, ['activeContract']);
      assert.equal((await request(secondPath, 'DELETE', undefined, ctx.cookie)).status, 200);
      assert.equal(await ctx.prisma.employmentContract.count({ where: { id: second.data.contract.id } }), 0);

      assert.equal((await request(contractPath, 'PATCH', { action: 'terminate', terminatedAt: '2026-10-01' }, ctx.cookie)).status, 400);
      const terminated = await request(contractPath, 'PATCH', { action: 'terminate', terminatedAt: '2027-03-31' }, ctx.cookie);
      assert.equal(terminated.status, 200);
      assert.equal(terminated.data.contract.status, 'TERMINATED');
      assert.equal((await request(contractPath, 'PATCH', { action: 'terminate', terminatedAt: '2027-04-01' }, ctx.cookie)).status, 409);
      const finalPdf = await fetch(`${base}${contractPath}/pdf`, { headers: { Cookie: ctx.cookie } });
      assert.equal(finalPdf.status, 200);

      const profile = await request(path, 'GET', undefined, ctx.cookie);
      assert.equal(profile.status, 200);
      assert.equal(profile.data.account.driver.employmentContracts.length, 1);
      assert.equal(profile.data.account.driver.nationality, 'Cambodian');
      const audit = await ctx.prisma.auditLog.findMany({ where: { actorId: ctx.id, entity: 'EmploymentContract' }, select: { action: true } });
      for (const action of ['CREATE', 'UPDATE', 'ACTIVATE', 'DELETE', 'TERMINATE', 'DOWNLOAD_PDF']) assert.ok(audit.some((entry) => entry.action === action), action);
    });
  } finally { await ctx.cleanup(); }
});
