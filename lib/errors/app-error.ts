// Custom error classes for the application

import { NextResponse } from "next/server";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: unknown) {
    super(400, message, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(400, message, 'BAD_REQUEST');
  }
}

// Error handler middleware for API routes
export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: error.toJSON(),
    };
  }

  if (error instanceof Error) {
    // Don't leak internal error details in production
    return {
      statusCode: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: process.env.NODE_ENV === 'development' 
            ? error.message 
            : 'An unexpected error occurred',
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
      },
    },
  };
}

// Helper to create error responses in route handlers
export function errorResponse(statusCode: number, message: string, code?: string) {
  return NextResponse.json(
    { error: { code, message } },
    { status: statusCode }
  );
}
