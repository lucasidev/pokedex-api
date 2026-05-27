import { ROLES, RoleModel } from '../../users/role.model.js';
import { User } from '../../users/user.model.js';
import { env } from '../config/env.js';
import { logger } from '../infra/logger.js';

async function createRoles(): Promise<void> {
  const count = await RoleModel.estimatedDocumentCount();
  if (count > 0) {
    return;
  }
  await Promise.all(ROLES.map((name) => new RoleModel({ name }).save()));
  logger.info({ roles: ROLES }, 'default roles created');
}

async function createAdmin(): Promise<void> {
  const existing = await User.findOne({ email: env.ADMIN_EMAIL });
  if (existing) {
    return;
  }

  const adminRole = await RoleModel.findOne({ name: 'admin' });
  if (!adminRole) {
    logger.error('admin role not found, skipping admin user creation');
    return;
  }

  const admin = new User({
    name: env.ADMIN_NAME,
    username: env.ADMIN_USERNAME,
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
    roles: [adminRole._id],
    pokedex: [],
    poketeam: null,
  });
  await admin.save();
  logger.info({ email: env.ADMIN_EMAIL }, 'admin user created');
}

export async function runInitialSetup(): Promise<void> {
  try {
    await createRoles();
    await createAdmin();
    logger.info('initial setup complete');
  } catch (error) {
    logger.error({ err: error }, 'initial setup failed');
  }
}
