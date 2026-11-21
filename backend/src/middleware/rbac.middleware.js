import { ApiError } from '../utils/ApiError.js';
import { SYSTEM_ROLES } from '@codeathon/shared';
import { roleRepository } from '../modules/roles/roles.repository.js';
import { userRepository } from '../modules/users/users.repository.js';

export const requirePermission = (permissionKey, sensitiveRecheck = false) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return next(ApiError.unauthorized('Authentication required'));
      }

      // Super Admin bypasses all checks
      if (user.role === SYSTEM_ROLES.SUPER_ADMIN || user.isSuperAdmin) {
        return next();
      }

      let permissions = user.permissions || [];

      // If sensitive recheck is requested, query the fresh user and role from database
      if (sensitiveRecheck) {
        const freshUser = await userRepository.findById(user.userId);
        if (!freshUser || !freshUser.isActive) {
          return next(ApiError.unauthorized('Account deactivated or deleted'));
        }
        if (freshUser.role === SYSTEM_ROLES.SUPER_ADMIN) {
          return next();
        }
        const freshRole = await roleRepository.findById(freshUser.roleId || freshUser.role);
        permissions = freshRole ? freshRole.permissions : [];
      }

      if (!permissions.includes(permissionKey)) {
        return next(
          ApiError.forbidden(
            `Access denied. Required permission: ${permissionKey}`,
            'PERMISSION_DENIED',
            { requiredPermission: permissionKey }
          )
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

export const requireSuperAdmin = () => {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    if (user.role === SYSTEM_ROLES.SUPER_ADMIN || user.isSuperAdmin) {
      return next();
    }
    return next(ApiError.forbidden('Super Admin privilege required', 'SUPER_ADMIN_REQUIRED'));
  };
};
