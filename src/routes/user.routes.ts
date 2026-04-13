import express from 'express';
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser
} from '../controllers/user.controller';
import { isAuthenticatedUser, authorizeRoles } from '../middleware/authMiddleware';
import { UserRole } from '../interfaces/user.interface';

const router = express.Router();

/**
 * All routes below require a valid JWT session
 */
router.use(isAuthenticatedUser);

/**
 * @route   GET /api/v1/users
 * @desc    Search and Directory Access
 * @access  Private (Staff, Judge, Registrar, Admin)
 */
router.get(
  '/get', 
  authorizeRoles(
    UserRole.SUPER_ADMIN, 
    UserRole.ADMIN, 
    UserRole.JUDGE, 
    UserRole.REGISTRAR,
    UserRole.STAFF
  ), 
  getAllUsers
);

/**
 * @route   POST /api/v1/users
 * @desc    Onboard new Judicial Officers or Staff
 * @access  Private (Admin & Super Admin)
 */
router.post(
  '/create', 
  authorizeRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN), 
  createUser
);

/**
 * @route   PATCH /api/v1/users/:id
 * @desc    Promote/Demote roles or update user status
 * @access  Private (Super Admin Only)
 */
router.patch(
  '/update/:id', 
  authorizeRoles(UserRole.SUPER_ADMIN), 
  updateUser
);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Offboard/Remove user access
 * @access  Private (Super Admin Only)
 */
router.delete(
  '/delete/:id', 
  authorizeRoles(UserRole.SUPER_ADMIN), 
  deleteUser
);

export default router;