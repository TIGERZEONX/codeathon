import { userRepository } from '../src/modules/users/users.repository.js';
import { roleRepository } from '../src/modules/roles/roles.repository.js';
import { hashPassword } from '../src/utils/password.js';
import { env } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';
import { SYSTEM_ROLES, ALL_PERMISSIONS } from '@codeathon/shared';

export const seedSuperAdmin = async () => {
  try {
    const existing = await userRepository.findByEmail(env.SUPER_ADMIN_EMAIL);
    if (existing) {
      return existing;
    }

    const hashedPassword = await hashPassword(env.SUPER_ADMIN_PASSWORD);
    const superAdmin = await userRepository.create({
      id: 'super_admin_user',
      name: 'Super Admin',
      email: env.SUPER_ADMIN_EMAIL.toLowerCase(),
      password: hashedPassword,
      role: SYSTEM_ROLES.SUPER_ADMIN,
      roleId: SYSTEM_ROLES.SUPER_ADMIN,
      roleName: 'Super Admin',
      contestScope: [],
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    logger.info(`Super Admin seeded successfully: ${env.SUPER_ADMIN_EMAIL}`);
    return superAdmin;
  } catch (err) {
    logger.error('Failed to seed Super Admin', { error: err.message });
  }
};

if (process.argv[1]?.endsWith('seed-super-admin.js')) {
  seedSuperAdmin().then(() => process.exit(0));
}
