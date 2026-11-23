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

    // Also seed standard Administrator account if not present
    const existingAdmin = await userRepository.findByEmail('admin@hirepro.dev') || await userRepository.findByEmail('admin@codeathon.dev');
    if (!existingAdmin) {
      const hashedAdminPassword = await hashPassword('AdminPassword@123');
      await userRepository.create({
        id: 'admin_user',
        name: 'Administrator',
        email: 'admin@hirepro.dev',
        password: hashedAdminPassword,
        role: SYSTEM_ROLES.ADMIN,
        roleId: SYSTEM_ROLES.ADMIN,
        roleName: 'Admin',
        contestScope: [],
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      logger.info('Standard Administrator seeded successfully: admin@hirepro.dev');
    }

    // Ensure Gautham has Super Admin role
    const existingGautham = await userRepository.findByEmail('gautham3177@gmail.com');
    if (existingGautham) {
      await userRepository.update(existingGautham.id, {
        role: SYSTEM_ROLES.SUPER_ADMIN,
        roleId: SYSTEM_ROLES.SUPER_ADMIN,
        roleName: 'Super Admin',
      });
      logger.info('Promoted gautham3177@gmail.com to Super Admin');
    } else {
      const hashedGauthamPassword = await hashPassword('123456');
      await userRepository.create({
        id: 'gautham_super_admin',
        name: 'gautham kumar',
        email: 'gautham3177@gmail.com',
        rollNumber: '2024PECAI381',
        password: hashedGauthamPassword,
        role: SYSTEM_ROLES.SUPER_ADMIN,
        roleId: SYSTEM_ROLES.SUPER_ADMIN,
        roleName: 'Super Admin',
        contestScope: [],
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      logger.info('Seeded gautham3177@gmail.com as Super Admin');
    }

    return superAdmin;
  } catch (err) {
    logger.error('Failed to seed Super Admin', { error: err.message });
  }
};

if (process.argv[1]?.endsWith('seed-super-admin.js')) {
  seedSuperAdmin().then(() => process.exit(0));
}
