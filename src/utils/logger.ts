import { config } from "../config/env"; // Import configuration

// Log levels enum
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Log entry interface
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  requestId?: string;
  userId?: string;
  sessionId?: string;
}

// Logger class for structured logging
export class Logger {
  private static instance: Logger; // Singleton instance
  private logLevel: LogLevel; // Current log level
  private logs: LogEntry[] = []; // In-memory log storage
  private maxLogs: number = 1000; // Maximum logs to keep in memory

  // Private constructor for singleton pattern
  private constructor() {
    this.logLevel = this.getLogLevelFromConfig();
  }

  // Get singleton instance
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  // Get log level from configuration
  private getLogLevelFromConfig(): LogLevel {
    switch (config.LOG_LEVEL.toLowerCase()) {
      case "error":
        return LogLevel.ERROR;
      case "warn":
        return LogLevel.WARN;
      case "info":
        return LogLevel.INFO;
      case "debug":
        return LogLevel.DEBUG;
      default:
        return LogLevel.INFO; // Default to INFO
    }
  }

  // Set log level
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info("Log level changed", { newLevel: LogLevel[level] });
  }

  // Log error message
  public error(
    message: string,
    context?: Record<string, any>,
    error?: Error,
  ): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  // Log warning message
  public warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  // Log info message
  public info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  // Log debug message
  public debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  // Core logging method
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error,
  ): void {
    // Check if we should log this level
    if (level > this.logLevel) {
      return;
    }

    // Create log entry
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      // Extract request/user/session info from context if available
      requestId: context?.requestId,
      userId: context?.userId,
      sessionId: context?.sessionId,
    };

    // Add context only if it exists
    if (context !== undefined) {
      logEntry.context = context;
    }

    // Add error only if it exists
    if (error !== undefined) {
      logEntry.error = error;
    }

    // Add to in-memory storage
    this.addLogToMemory(logEntry);

    // Output to console
    this.outputToConsole(logEntry);
  }

  // Add log to memory storage
  private addLogToMemory(logEntry: LogEntry): void {
    this.logs.push(logEntry);

    // Remove old logs if we exceed the maximum
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  // Output log to console with formatting
  private outputToConsole(logEntry: LogEntry): void {
    const timestamp = logEntry.timestamp.toISOString();
    const levelStr = LogLevel[logEntry.level].padEnd(5);
    const requestIdStr = logEntry.requestId ? `[${logEntry.requestId}] ` : "";
    const sessionIdStr = logEntry.sessionId ? `[${logEntry.sessionId}] ` : "";

    let logMessage = `${timestamp} ${levelStr} ${requestIdStr}${sessionIdStr}${logEntry.message}`;

    // Add context information
    if (logEntry.context && Object.keys(logEntry.context).length > 0) {
      // Remove request/user/session info from context to avoid duplication
      const { requestId, userId, sessionId, ...cleanContext } =
        logEntry.context;
      if (Object.keys(cleanContext).length > 0) {
        logMessage += ` | ${JSON.stringify(cleanContext)}`;
      }
    }

    // Output based on level
    switch (logEntry.level) {
      case LogLevel.ERROR:
        console.error(logMessage);
        if (logEntry.error) {
          console.error("Error details:", logEntry.error);
        }
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.INFO:
        console.log(logMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
    }
  }

  // Get logs from memory
  public getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let filteredLogs = this.logs;

    // Filter by level if specified
    if (level !== undefined) {
      filteredLogs = filteredLogs.filter((log) => log.level <= level);
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit if specified
    if (limit && limit > 0) {
      filteredLogs = filteredLogs.slice(0, limit);
    }

    return filteredLogs;
  }

  // Get logs by session ID
  public getLogsBySessionId(sessionId: string, level?: LogLevel): LogEntry[] {
    let filteredLogs = this.logs.filter((log) => log.sessionId === sessionId);

    // Filter by level if specified
    if (level !== undefined) {
      filteredLogs = filteredLogs.filter((log) => log.level <= level);
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return filteredLogs;
  }

  // Get logs by request ID
  public getLogsByRequestId(requestId: string): LogEntry[] {
    const filteredLogs = this.logs.filter((log) => log.requestId === requestId);

    // Sort by timestamp (oldest first for request flow)
    filteredLogs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return filteredLogs;
  }

  // Clear all logs
  public clearLogs(): void {
    this.logs = [];
    this.info("Logs cleared");
  }

  // Get logging statistics
  public getStats(): {
    totalLogs: number;
    logsByLevel: Record<string, number>;
    oldestLog?: Date;
    newestLog?: Date;
  } {
    const logsByLevel: Record<string, number> = {
      ERROR: 0,
      WARN: 0,
      INFO: 0,
      DEBUG: 0,
    };

    let oldestLog: Date | undefined;
    let newestLog: Date | undefined;

    for (const log of this.logs) {
      const levelName = LogLevel[log.level];
      if (levelName && logsByLevel[levelName] !== undefined) {
        logsByLevel[levelName]++;
      }

      if (!oldestLog || log.timestamp < oldestLog) {
        oldestLog = log.timestamp;
      }

      if (!newestLog || log.timestamp > newestLog) {
        newestLog = log.timestamp;
      }
    }

    const result: {
      totalLogs: number;
      logsByLevel: Record<string, number>;
      oldestLog?: Date;
      newestLog?: Date;
    } = {
      totalLogs: this.logs.length,
      logsByLevel,
    };

    if (oldestLog) {
      result.oldestLog = oldestLog;
    }

    if (newestLog) {
      result.newestLog = newestLog;
    }

    return result;
  }

  // Create child logger with additional context
  public child(context: Record<string, any>): ChildLogger {
    return new ChildLogger(this, context);
  }

  // Export logs to JSON
  public exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Get current log level
  public getLogLevel(): LogLevel {
    return this.logLevel;
  }
}

// Child logger class for additional context
export class ChildLogger {
  constructor(
    private parentLogger: Logger,
    private context: Record<string, any>,
  ) {}

  public error(
    message: string,
    additionalContext?: Record<string, any>,
    error?: Error,
  ): void {
    this.parentLogger.error(
      message,
      { ...this.context, ...additionalContext },
      error,
    );
  }

  public warn(message: string, additionalContext?: Record<string, any>): void {
    this.parentLogger.warn(message, { ...this.context, ...additionalContext });
  }

  public info(message: string, additionalContext?: Record<string, any>): void {
    this.parentLogger.info(message, { ...this.context, ...additionalContext });
  }

  public debug(message: string, additionalContext?: Record<string, any>): void {
    this.parentLogger.debug(message, { ...this.context, ...additionalContext });
  }

  public child(additionalContext: Record<string, any>): ChildLogger {
    return new ChildLogger(this.parentLogger, {
      ...this.context,
      ...additionalContext,
    });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience functions
export const logError = (
  message: string,
  context?: Record<string, any>,
  error?: Error,
): void => {
  logger.error(message, context, error);
};

export const logWarn = (
  message: string,
  context?: Record<string, any>,
): void => {
  logger.warn(message, context);
};

export const logInfo = (
  message: string,
  context?: Record<string, any>,
): void => {
  logger.info(message, context);
};

export const logDebug = (
  message: string,
  context?: Record<string, any>,
): void => {
  logger.debug(message, context);
};

// Create request-specific logger
export const createRequestLogger = (
  requestId: string,
  sessionId?: string,
  userId?: string,
): ChildLogger => {
  return logger.child({
    requestId,
    sessionId,
    userId,
  });
};
