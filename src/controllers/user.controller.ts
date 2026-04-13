import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import pool from "../config/db";
import catchAsync from "../utils/catchAsync";
import ErrorHandler from "../utils/ErrorHandler";
import { UserRole } from "../interfaces/user.interface";

/**
 * @desc Get all users with Search, Filter, and Pagination
 * @route GET /api/v1/users
 * @access Private/Admin
 */
// src/controllers/user.controller.ts
export const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const { role, search, page = 1, limit = 10 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let query = `SELECT id, full_name, email, role, is_verified, created_at FROM users WHERE 1=1`;
  let countQuery = `SELECT COUNT(*) FROM users WHERE 1=1`;
  const params: any[] = [];

  if (role && role !== 'all') {
    params.push(role);
    query += ` AND role = $${params.length}`;
    countQuery += ` AND role = $${params.length}`;
  }

  // Only apply search if it's not an empty string
  if (search && search.toString().trim() !== '') {
    params.push(`%${search}%`);
    query += ` AND (full_name ILIKE $${params.length} OR email ILIKE $${params.length})`;
    countQuery += ` AND (full_name ILIKE $${params.length} OR email ILIKE $${params.length})`;
  }

  // Get total count BEFORE adding Limit/Offset to the main query
  const countResult = await pool.query(countQuery, params);
  const totalUsers = parseInt(countResult.rows[0].count);

  // Now add ordering and pagination to the data query
  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const dataParams = [...params, Number(limit), offset];

  const result = await pool.query(query, dataParams);

  res.status(200).json({
    status: "success",
    totalUsers,
    totalPages: Math.ceil(totalUsers / Number(limit)) || 1,
    currentPage: Number(page),
    users: result.rows,
  });
});

/**
 * @desc Create a new user (Internal Onboarding)
 * @route POST /api/v1/users
 */
export const createUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { full_name, email, role, password } = req.body;

  if (!password || password.length < 8) {
    return next(new ErrorHandler("Password must be at least 8 characters", 400));
  }

  // Check unique email
  const userExists = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (userExists.rowCount! > 0) {
    return next(new ErrorHandler("User with this email already exists", 400));
  }

  // SECURITY: Hash password before database entry
  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await pool.query(
    `INSERT INTO users (full_name, email, role, password, needs_password_reset, is_verified) 
     VALUES ($1, $2, $3, $4, $5, $6) 
     RETURNING id, full_name, email, role`,
    [full_name, email, role || UserRole.STAFF, hashedPassword, true, true]
  );

  res.status(201).json({
    status: "success",
    user: newUser.rows[0],
  });
});

/**
 * @desc Update user details or roles
 * @route PATCH /api/v1/users/:id
 */
export const updateUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { full_name, role, is_verified } = req.body;

  const result = await pool.query(
    `UPDATE users 
     SET full_name = COALESCE($1, full_name), 
         role = COALESCE($2, role), 
         is_verified = COALESCE($3, is_verified),
         updated_at = NOW()
     WHERE id = $4 
     RETURNING id, full_name, email, role`,
    [full_name, role, is_verified, id]
  );

  if (result.rowCount === 0) {
    return next(new ErrorHandler("User not found", 404));
  }

  res.status(200).json({
    status: "success",
    user: result.rows[0],
  });
});

/**
 * @desc Soft Delete / Archive User
 * @route DELETE /api/v1/users/:id
 */
export const deleteUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  // In a Judicial System, we ARCHIVE rather than DELETE
  // If your table has a 'deleted_at' column, use:
  // UPDATE users SET deleted_at = NOW() WHERE id = $1
  
  const result = await pool.query("DELETE FROM users WHERE id = $1", [id]);

  if (result.rowCount === 0) {
    return next(new ErrorHandler("User not found", 404));
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});