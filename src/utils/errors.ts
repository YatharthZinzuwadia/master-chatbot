import { CopilotError } from '../types';  // Import custom error type
import { logger } from './logger';  // Import logger

// Custom error classes for different types of errors
export class ValidationError extends CopilotError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
    logger.error('Validation error', { details }, this);
  }
}

export class AuthenticationError extends CopilotError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
    logger.error('Authentication error', {}, this);
  }
}

export class AuthorizationError extends CopilotError {
  constructor(message: string = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
    logger.error('Authorization error', {}, this);
  }
}

export class NotFoundError extends CopilotError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
    logger.error('Not found error', { resource, id }, this);
  }
}

export class ConflictError extends CopilotError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
    logger.error('Conflict error', { details }, this);
  }
}

export class RateLimitError extends CopilotError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 'RATE_LIMIT', 429);
    this.name = 'RateLimitError';
    logger.error('Rate limit error', { retryAfter }, this);
  }
}

export class DatabaseError extends CopilotError {
  constructor(message: string, operation?: string) {
    super(message, 'DATABASE_ERROR', 500);
    this.name = 'DatabaseError';
    logger.error('Database error', { operation }, this);
  }
}

export class ModelError extends CopilotError {
  constructor(message: string, provider?: string, model?: string) {
    super(message, 'MODEL_ERROR', 500);
    this.name = 'ModelError';
    logger.error('Model error', { provider, model }, this);
  }
}

export class ToolError extends CopilotError {
  constructor(message: string, toolName?: string, operation?: string) {
    super(message, 'TOOL_ERROR', 500);
    this.name = 'ToolError';
    logger.error('Tool error', { toolName, operation }, this);
  }
}

export class ConfigurationError extends CopilotError {
  constructor(message: string, configKey?: string) {
    super(message, 'CONFIGURATION_ERROR', 500);
    this.name = 'ConfigurationError';
    logger.error('Configuration error', { configKey }, this);
  }
}

export class ExternalServiceError extends CopilotError {
  constructor(message: string, service?: string, statusCode?: number) {
    super(message, 'EXTERNAL_SERVICE_ERROR', 502);
    this.name = 'ExternalServiceError';
    logger.error('External service error', { service, statusCode }, this);
  }
}

// Error handling utilities
export class ErrorHandler {
  // Handle and format errors for API responses
  static handleApiError(error: unknown): {
    statusCode: number;
    body: {
      success: false;
      error: string;
      code?: string;
      timestamp: Date;
    };
  } {
    if (error instanceof CopilotError) {
      // Custom application error
      return {
        statusCode: error.statusCode,
        body: {
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date()
        }
      };
    }

    if (error instanceof Error) {
      // Standard JavaScript error
      logger.error('Unhandled error', {}, error);
      
      return {
        statusCode: 500,
        body: {
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          timestamp: new Date()
        }
      };
    }

    // Unknown error type
    logger.error('Unknown error type', { error: String(error) });
    
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Internal server error',
        code: 'UNKNOWN_ERROR',
        timestamp: new Date()
      }
    };
  }

  // Wrap async functions with error handling
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (context) {
        logger.error('Operation failed', context, error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  }

  // Create error response middleware for Express
  static errorHandler() {
    return (error: unknown, req: any, res: any, next: any) => {
      const { statusCode, body } = this.handleApiError(error);
      
      // Add request context to error log
      logger.error('API error', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.requestId,
        sessionId: req.sessionId,
        userId: req.userId
      }, error instanceof Error ? error : new Error(String(error)));

      res.status(statusCode).json(body);
    };
  }

  // Create 404 handler middleware
  static notFoundHandler() {
    return (req: any, res: any) => {
      const error = new NotFoundError('API endpoint', req.path);
      const { statusCode, body } = this.handleApiError(error);
      
      res.status(statusCode).json(body);
    };
  }

  // Validate input and throw ValidationError if invalid
  static validateInput(input: any, rules: ValidationRules): void {
    const errors = this.validate(input, rules);
    
    if (errors.length > 0) {
      throw new ValidationError('Input validation failed', { errors });
    }
  }

  // Perform validation
  private static validate(input: any, rules: ValidationRules): string[] {
    const errors: string[] = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = input[field];

      // Required validation
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      // Skip other validations if field is not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (rule.type && typeof value !== rule.type) {
        errors.push(`${field} must be of type ${rule.type}`);
      }

      // String validations
      if (typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`${field} must be at least ${rule.minLength} characters long`);
        }
        
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`${field} must be no more than ${rule.maxLength} characters long`);
        }
        
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${field} does not match required pattern`);
        }
      }

      // Number validations
      if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`${field} must be at least ${rule.min}`);
        }
        
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`${field} must be no more than ${rule.max}`);
        }
      }

      // Array validations
      if (Array.isArray(value)) {
        if (rule.minItems && value.length < rule.minItems) {
          errors.push(`${field} must have at least ${rule.minItems} items`);
        }
        
        if (rule.maxItems && value.length > rule.maxItems) {
          errors.push(`${field} must have no more than ${rule.maxItems} items`);
        }
      }

      // Custom validation
      if (rule.custom && !rule.custom(value)) {
        errors.push(`${field} failed custom validation`);
      }
    }

    return errors;
  }

  // Retry operation with exponential backoff
  static async retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    context?: Record<string, any>
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          logger.error('Operation failed after all retries', { 
            attempts: maxRetries, 
            context 
          }, error instanceof Error ? error : new Error(String(error)));
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        logger.warn(`Operation failed, retrying in ${delay}ms`, {
          attempt,
          maxRetries,
          context
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  // Sleep utility
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Circuit breaker pattern implementation
  static createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
    operation: T,
    options: CircuitBreakerOptions = {}
  ): T {
    const {
      failureThreshold = 5,
      resetTimeout = 60000,
      monitoringPeriod = 10000
    } = options;

    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    let failures = 0;
    let lastFailureTime = 0;
    let nextAttempt = 0;

    return (async (...args: Parameters<T>) => {
      const now = Date.now();

      // Check if we should attempt to reset
      if (state === 'OPEN' && now >= nextAttempt) {
        state = 'HALF_OPEN';
        logger.info('Circuit breaker transitioning to HALF_OPEN');
      }

      // Reject if circuit is open
      if (state === 'OPEN') {
        throw new ExternalServiceError('Circuit breaker is OPEN', 'circuit-breaker');
      }

      try {
        const result = await operation(...args);

        // Reset on success
        if (state === 'HALF_OPEN') {
          state = 'CLOSED';
          failures = 0;
          logger.info('Circuit breaker reset to CLOSED');
        }

        return result;
      } catch (error) {
        failures++;
        lastFailureTime = now;

        if (failures >= failureThreshold) {
          state = 'OPEN';
          nextAttempt = now + resetTimeout;
          logger.error('Circuit breaker opened', {
            failures,
            threshold: failureThreshold,
            resetTimeout
          });
        }

        throw error;
      }
    }) as T;
  }
}

// Validation rules interface
export interface ValidationRules {
  [field: string]: {
    required?: boolean;
    type?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    minItems?: number;
    maxItems?: number;
    pattern?: RegExp;
    custom?: (value: any) => boolean;
  };
}

// Circuit breaker options interface
export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  monitoringPeriod?: number;
}

// Export common error instances
export const CommonErrors = {
  INVALID_REQUEST: new ValidationError('Invalid request format'),
  UNAUTHORIZED: new AuthenticationError(),
  FORBIDDEN: new AuthorizationError(),
  NOT_FOUND: new NotFoundError('Resource'),
  CONFLICT: new ConflictError('Resource conflict'),
  RATE_LIMITED: new RateLimitError(),
  INTERNAL_ERROR: new CopilotError('Internal server error', 'INTERNAL_ERROR', 500),
  SERVICE_UNAVAILABLE: new ExternalServiceError('Service temporarily unavailable'),
  DATABASE_UNAVAILABLE: new DatabaseError('Database connection failed'),
  MODEL_UNAVAILABLE: new ModelError('Model service unavailable'),
  CONFIGURATION_MISSING: new ConfigurationError('Required configuration is missing')
};

// Error context builder
export class ErrorContext {
  private context: Record<string, any> = {};

  static create(): ErrorContext {
    return new ErrorContext();
  }

  add(key: string, value: any): ErrorContext {
    this.context[key] = value;
    return this;
  }

  addRequest(req: any): ErrorContext {
    this.context.request = {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    return this;
  }

  addUser(userId?: string, sessionId?: string): ErrorContext {
    if (userId) this.context.userId = userId;
    if (sessionId) this.context.sessionId = sessionId;
    return this;
  }

  addOperation(operation: string, details?: Record<string, any>): ErrorContext {
    this.context.operation = { name: operation, ...details };
    return this;
  }

  addTiming(startTime: number): ErrorContext {
    this.context.duration = Date.now() - startTime;
    return this;
  }

  get(): Record<string, any> {
    return this.context;
  }

  build(): Record<string, any> {
    return { ...this.context };
  }
}
