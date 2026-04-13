// src/utils/ErrorHandler.ts
class ErrorHandler extends Error {
  public statusCode: number;
  public status: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // To distinguish between known errors and unknown bugs

    Error.captureStackTrace(this, this.constructor);
  }
}

export default ErrorHandler;