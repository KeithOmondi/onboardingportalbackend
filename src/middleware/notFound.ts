// src/middleware/notFound.ts
import { Request, Response, NextFunction } from 'express';
import ErrorHandler from '../utils/ErrorHandler';

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new ErrorHandler(`Not Found - ${req.originalUrl}`, 404);
  next(error);
};