// FEEDR - Error Handling Utilities
// Centralized error handling for edge functions

export class FeedrError extends Error {
  public code: string;
  public statusCode: number;
  public retryable: boolean;
  public details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    retryable: boolean = false,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "FeedrError";
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.details = details;
  }
}

// Error codes
export const ErrorCodes = {
  // Auth errors
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_INVALID: "AUTH_INVALID",
  
  // Validation errors
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED: "MISSING_REQUIRED",
  
  // Service errors
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  SERVICE_TIMEOUT: "SERVICE_TIMEOUT",
  SERVICE_RATE_LIMITED: "SERVICE_RATE_LIMITED",
  SERVICE_ERROR: "SERVICE_ERROR",
  
  // Resource errors
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  
  // Processing errors
  PROCESSING_FAILED: "PROCESSING_FAILED",
  GENERATION_FAILED: "GENERATION_FAILED",
  
  // Internal errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  STORAGE_ERROR: "STORAGE_ERROR",
} as const;

// Predefined errors
export const Errors = {
  authRequired: () => new FeedrError(
    "Authentication required",
    ErrorCodes.AUTH_REQUIRED,
    401,
    false
  ),
  
  invalidInput: (field: string) => new FeedrError(
    `Invalid input: ${field}`,
    ErrorCodes.INVALID_INPUT,
    400,
    false,
    { field }
  ),
  
  serviceUnavailable: (service: string) => new FeedrError(
    `Service unavailable: ${service}`,
    ErrorCodes.SERVICE_UNAVAILABLE,
    503,
    true,
    { service }
  ),
  
  serviceTimeout: (service: string) => new FeedrError(
    `Service timeout: ${service}`,
    ErrorCodes.SERVICE_TIMEOUT,
    504,
    true,
    { service }
  ),
  
  serviceRateLimited: (service: string) => new FeedrError(
    `Rate limited: ${service}`,
    ErrorCodes.SERVICE_RATE_LIMITED,
    429,
    true,
    { service }
  ),
  
  notFound: (resource: string) => new FeedrError(
    `Not found: ${resource}`,
    ErrorCodes.NOT_FOUND,
    404,
    false,
    { resource }
  ),
  
  processingFailed: (reason: string) => new FeedrError(
    `Processing failed: ${reason}`,
    ErrorCodes.PROCESSING_FAILED,
    500,
    true,
    { reason }
  ),
  
  internal: (message: string = "Internal server error") => new FeedrError(
    message,
    ErrorCodes.INTERNAL_ERROR,
    500,
    false
  ),
};

/**
 * Handle an error and return appropriate response
 */
export function handleError(error: unknown): {
  statusCode: number;
  body: { error: string; code: string; retryable: boolean; details?: unknown };
} {
  if (error instanceof FeedrError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
        retryable: error.retryable,
        details: error.details,
      },
    };
  }
  
  // Unknown error
  const message = error instanceof Error ? error.message : "Unknown error";
  return {
    statusCode: 500,
    body: {
      error: message,
      code: ErrorCodes.INTERNAL_ERROR,
      retryable: false,
    },
  };
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T>(
  fn: () => Promise<T>,
  onError?: (error: unknown) => void
): Promise<T> {
  return fn().catch((error) => {
    if (onError) onError(error);
    throw error;
  });
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    retryIf?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    retryIf = (error) => error instanceof FeedrError && error.retryable,
  } = options;

  let lastError: unknown;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts || !retryIf(error)) {
        throw error;
      }

      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Log error with context
 */
export function logError(
  error: unknown,
  context: Record<string, unknown> = {}
): void {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    code: error instanceof FeedrError ? error.code : undefined,
    ...context,
  };
  
  console.error("FEEDR Error:", JSON.stringify(errorInfo, null, 2));
}
