import express from "express"; // Import Express framework
import cors from "cors"; // Import CORS middleware
import helmet from "helmet"; // Import security middleware
import { config } from "./config/env"; // Import configuration
import { mongoConnection } from "./memory/mongo"; // Import MongoDB connection
import { initializeModelAdapter } from "./models"; // Import model adapter
import { logger, createRequestLogger } from "./utils/logger"; // Import logger
import { ErrorHandler } from "./utils/errors"; // Import error handler
import {
  copilotRouter,
  initializeOrchestrator,
} from "./api/routes/copilot.route"; // Import copilot routes
import { healthRouter } from "./api/routes/health.route"; // Import health routes
import { v4 as uuidv4 } from "uuid"; // Import UUID generator

// Create Express application
const app = express();

// Server state
let server: any = null;
let isShuttingDown = false;

// Initialize the application
async function initializeApp(): Promise<void> {
  try {
    logger.info("Initializing AI Copilot server...");

    // Validate configuration
    validateConfiguration();

    // Connect to MongoDB
    await connectDatabase();

    // Initialize model adapter
    await initializeModel();

    // Setup middleware
    setupMiddleware();

    // Setup routes
    setupRoutes();

    // Setup error handling
    setupErrorHandling();

    logger.info("AI Copilot server initialized successfully");
  } catch (error) {
    logger.error(
      "Failed to initialize server",
      {},
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  }
}

// Validate configuration
function validateConfiguration(): void {
  logger.info("Validating configuration...");

  // Configuration is already validated in env.ts
  // Add any additional validation here if needed

  logger.info("Configuration validation completed", {
    port: config.PORT,
    modelProvider: config.MODEL_PROVIDER,
    modelName: config.MODEL_NAME,
    logLevel: config.LOG_LEVEL,
  });
}

// Connect to database
async function connectDatabase(): Promise<void> {
  logger.info("Connecting to MongoDB...");

  await mongoConnection.connect();

  logger.info("MongoDB connection established");
}

// Initialize model adapter
async function initializeModel(): Promise<void> {
  logger.info("Initializing model adapter...");

  initializeModelAdapter();

  logger.info("Model adapter initialized", {
    provider: config.MODEL_PROVIDER,
    model: config.MODEL_NAME,
  });

  // Initialize orchestrator after model adapter is ready
  logger.info("Initializing orchestrator...");
  initializeOrchestrator();

  logger.info("Orchestrator initialized successfully");
}

// Setup middleware
function setupMiddleware(): void {
  logger.info("Setting up middleware...");

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable CSP for AI responses
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS middleware
  app.use(
    cors({
      origin: true, // Allow all origins (configure as needed)
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    }),
  );

  // Request parsing middleware
  app.use(express.json({ limit: "10mb" })); // Parse JSON bodies
  app.use(express.urlencoded({ extended: true, limit: "10mb" })); // Parse URL-encoded bodies

  // Request logging middleware
  app.use((req: any, res: any, next: any) => {
    // Generate unique request ID
    const requestId = req.get("X-Request-ID") || uuidv4();

    // Add request ID to request object
    req.requestId = requestId;

    // Create request-specific logger
    req.logger = createRequestLogger(requestId);

    // Log request
    req.logger.info("Request received", {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      contentLength: req.get("Content-Length"),
    });

    // Add response logging
    const originalSend = res.send;
    res.send = function (body: any) {
      req.logger.info("Request completed", {
        statusCode: res.statusCode,
        responseSize: body ? body.length : 0,
      });
      return originalSend.call(this, body);
    };

    next();
  });

  logger.info("Middleware setup completed");
}

// Setup routes
function setupRoutes(): void {
  logger.info("Setting up routes...");

  // API routes
  app.use("/api/health", healthRouter);
  app.use("/api/copilot", copilotRouter);

  // Root endpoint
  app.get("/", (req: any, res: any) => {
    res.json({
      name: "AI Copilot Backend Service",
      version: "1.0.0",
      status: "running",
      timestamp: new Date(),
      endpoints: {
        health: "/api/health",
        copilot: "/api/copilot",
        documentation: "/api/docs",
      },
    });
  });

  // API documentation endpoint
  app.get("/api/docs", (req: any, res: any) => {
    res.json({
      title: "AI Copilot API Documentation",
      version: "1.0.0",
      endpoints: {
        "POST /api/copilot/run": {
          description: "Process a user message and get AI response",
          parameters: {
            message: "string (required)",
            sessionId: "string (optional)",
            context: "object (optional)",
          },
        },
        "GET /api/copilot/history/:sessionId": {
          description: "Get conversation history for a session",
          parameters: {
            sessionId: "string (required)",
            limit: "number (optional, default: 50)",
            includeMetadata: "boolean (optional, default: false)",
          },
        },
        "GET /api/copilot/session/:sessionId": {
          description: "Get session information",
          parameters: {
            sessionId: "string (required)",
          },
        },
        "DELETE /api/copilot/session/:sessionId": {
          description: "Delete a session and all its messages",
          parameters: {
            sessionId: "string (required)",
          },
        },
        "GET /api/copilot/tools": {
          description: "Get list of available tools",
          parameters: {},
        },
        "GET /api/copilot/stats": {
          description: "Get orchestrator statistics",
          parameters: {},
        },
        "GET /api/health": {
          description: "Health check for all services",
          parameters: {},
        },
        "GET /api/health/detailed": {
          description: "Detailed health check with system information",
          parameters: {},
        },
        "GET /api/health/ready": {
          description: "Readiness check for Kubernetes",
          parameters: {},
        },
        "GET /api/health/live": {
          description: "Liveness check for Kubernetes",
          parameters: {},
        },
      },
    });
  });

  logger.info("Routes setup completed");
}

// Setup error handling
function setupErrorHandling(): void {
  logger.info("Setting up error handling...");

  // 404 handler
  app.use(ErrorHandler.notFoundHandler());

  // Global error handler
  app.use(ErrorHandler.errorHandler());

  logger.info("Error handling setup completed");
}

// Start the server
async function startServer(): Promise<void> {
  try {
    await initializeApp();

    server = app.listen(config.PORT, () => {
      logger.info("AI Copilot server started successfully", {
        port: config.PORT,
        environment: process.env.NODE_ENV || "development",
        pid: process.pid,
      });

      // Log startup information
      logger.info("Server information", {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      });
    });

    // Handle server errors
    server.on("error", (error: any) => {
      if (error.code === "EADDRINUSE") {
        logger.error(`Port ${config.PORT} is already in use`);
      } else {
        logger.error("Server error", {}, error);
      }
      process.exit(1);
    });

    // Setup graceful shutdown handlers
    setupGracefulShutdown();
  } catch (error) {
    logger.error(
      "Failed to start server",
      {},
      error instanceof Error ? error : new Error(String(error)),
    );
    process.exit(1);
  }
}

// Setup graceful shutdown
function setupGracefulShutdown(): void {
  logger.info("Setting up graceful shutdown handlers...");

  // Handle SIGTERM (sent by systemd, Kubernetes, etc.)
  process.on("SIGTERM", () => {
    logger.info("Received SIGTERM, starting graceful shutdown...");
    gracefulShutdown("SIGTERM");
  });

  // Handle SIGINT (sent by Ctrl+C)
  process.on("SIGINT", () => {
    logger.info("Received SIGINT, starting graceful shutdown...");
    gracefulShutdown("SIGINT");
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", (error: Error) => {
    logger.error("Uncaught exception", {}, error);
    gracefulShutdown("uncaughtException");
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
    logger.error("Unhandled promise rejection", {
      reason: String(reason),
      promise: promise.toString(),
    });
    gracefulShutdown("unhandledRejection");
  });

  logger.info("Graceful shutdown handlers setup completed");
}

// Graceful shutdown function
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn("Shutdown already in progress, ignoring signal", { signal });
    return;
  }

  isShuttingDown = true;
  logger.info("Starting graceful shutdown", { signal });

  const shutdownTimeout = 30000; // 30 seconds timeout
  const shutdownStart = Date.now();

  try {
    // Stop accepting new requests
    if (server) {
      logger.info("Closing HTTP server...");
      server.close(() => {
        logger.info("HTTP server closed");
      });
    }

    // Close database connection
    logger.info("Closing database connection...");
    await mongoConnection.disconnect();
    logger.info("Database connection closed");

    // Log shutdown completion
    const shutdownDuration = Date.now() - shutdownStart;
    logger.info("Graceful shutdown completed", {
      signal,
      duration: shutdownDuration,
    });

    process.exit(0);
  } catch (error) {
    logger.error(
      "Error during graceful shutdown",
      {},
      error instanceof Error ? error : new Error(String(error)),
    );

    // Force exit if graceful shutdown fails
    setTimeout(
      () => {
        logger.error("Forced exit due to shutdown timeout");
        process.exit(1);
      },
      shutdownTimeout - (Date.now() - shutdownStart),
    );
  }
}

// Handle process termination
process.on("exit", (code: number) => {
  logger.info("Process exiting", { code });
});

// Start the server if this file is run directly
if (require.main === module) {
  startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}

// Export for testing
export { app, startServer, gracefulShutdown };
