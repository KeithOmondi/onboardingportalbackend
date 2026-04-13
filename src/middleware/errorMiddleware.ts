// src/middleware/errorMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import ErrorHandler from '../utils/ErrorHandler'; // Now being used as a type!
import config from '../config/env';

export const globalErrorHandler = (
  err: ErrorHandler | any, // Use the class as a type here
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

  if (config.NODE_ENV === 'development') {
    res.status(statusCode).json({
      status: status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  } else {
    // In Production
    if (err.isOperational) {
      res.status(statusCode).json({
        status: status,
        message: err.message,
      });
    } else {
      console.error('ERROR 💥', err);
      res.status(500).json({
        status: 'error',
        message: 'Something went very wrong!',
      });
    }
  }
};