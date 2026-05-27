import { runInitialSetup } from '../src/shared/utils/initialSetup.js';
import { ROLES, RoleModel } from '../src/users/role.model.js';
import { User } from '../src/users/user.model.js';
import { clearDatabase, startInMemoryMongo, stopInMemoryMongo } from './helpers/testDb.js';

describe('runInitialSetup', () => {
  beforeAll(async () => {
    await startInMemoryMongo();
  });

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it('creates all roles when none exist', async () => {
    await runInitialSetup();

    const roles = await RoleModel.find().lean();
    const names = roles.map((r) => r.name).sort();
    expect(names).toEqual([...ROLES].sort());
  });

  it('creates the admin user attached to the admin role', async () => {
    await runInitialSetup();

    const admin = await User.findOne({ email: 'admin@test.local' }).populate<{
      roles: { name: string }[];
    }>('roles');
    expect(admin).not.toBeNull();
    const roleNames = admin?.roles.map((r) => r.name) ?? [];
    expect(roleNames).toContain('admin');
  });

  it('is idempotent: running twice does not duplicate roles or admin', async () => {
    await runInitialSetup();
    await runInitialSetup();

    const roleCount = await RoleModel.countDocuments();
    const adminCount = await User.countDocuments({ email: 'admin@test.local' });
    expect(roleCount).toBe(ROLES.length);
    expect(adminCount).toBe(1);
  });
});
