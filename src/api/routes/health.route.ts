import { Router, Request, Response, NextFunction } from "express"; // Import Express types
import { ApiResponse, HealthResponse, ServiceHealth } from "../../types"; // Import relevant types
import { mongoConnection } from "../../memory/mongo"; // Import MongoDB connection
import { checkModelHealth } from "../../models"; // Import model health check
import { config } from "../../config/env"; // Import configuration

// Create Express router for health routes
const router = Router();

// Main health check endpoint
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("Performing health check");

    // Check all services
    const services: ServiceHealth[] = [];

    // Check MongoDB connection
    const mongoHealth = await mongoConnection.healthCheck();
    const mongoService: ServiceHealth = {
      name: "mongodb",
      status: mongoHealth.status,
    };
    if (mongoHealth.responseTime !== undefined) {
      mongoService.responseTime = mongoHealth.responseTime;
    }
    if (mongoHealth.error !== undefined) {
      mongoService.error = mongoHealth.error;
    }
    services.push(mongoService);

    // Check model adapter
    const modelHealth = await checkModelHealth();
    const modelService: ServiceHealth = {
      name: "model-adapter",
      status: modelHealth.healthy ? "healthy" : "unhealthy",
    };
    if (modelHealth.error !== undefined) {
      modelService.error = modelHealth.error;
    }
    services.push(modelService);

    // Check memory usage
    const memoryHealth = checkMemoryUsage();
    services.push(memoryHealth);

    // Check disk space
    const diskHealth = checkDiskSpace();
    services.push(diskHealth);

    // Determine overall health status
    const overallStatus = services.some(
      (service) => service.status === "unhealthy",
    )
      ? "unhealthy"
      : "healthy";

    const healthResponse: HealthResponse = {
      status: overallStatus,
      timestamp: new Date(),
      services,
    };

    const response: ApiResponse<HealthResponse> = {
      success: overallStatus === "healthy",
      data: healthResponse,
      timestamp: new Date(),
    };

    // Set appropriate HTTP status code
    const statusCode = overallStatus === "healthy" ? 200 : 503;

    console.log("Health check completed:", {
      status: overallStatus,
      serviceCount: services.length,
      unhealthyServices: services.filter((s) => s.status === "unhealthy")
        .length,
    });

    res.status(statusCode).json(response);
  } catch (error) {
    console.error("Error during health check:", error);

    const healthResponse: HealthResponse = {
      status: "unhealthy",
      timestamp: new Date(),
      services: [
        {
          name: "health-check",
          status: "unhealthy",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      ],
    };

    const response: ApiResponse<HealthResponse> = {
      success: false,
      data: healthResponse,
      timestamp: new Date(),
    };

    res.status(503).json(response);
  }
});

// Detailed health check endpoint
router.get(
  "/detailed",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log("Performing detailed health check");

      const detailedInfo = {
        // System information
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          pid: process.pid,
        },

        // Application configuration
        configuration: {
          port: config.PORT,
          modelProvider: config.MODEL_PROVIDER,
          modelName: config.MODEL_NAME,
          maxTokens: config.MAX_TOKENS,
          temperature: config.TEMPERATURE,
          logLevel: config.LOG_LEVEL,
        },

        // Service health (reuse main health check)
        services: await getServiceHealthDetails(),

        // Performance metrics
        performance: {
          cpuUsage: process.cpuUsage(),
          memoryUsage: process.memoryUsage(),
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external,
          arrayBuffers: process.memoryUsage().arrayBuffers,
        },
      };

      const response: ApiResponse = {
        success: true,
        data: detailedInfo,
        timestamp: new Date(),
      };

      console.log("Detailed health check completed");

      res.json(response);
    } catch (error) {
      console.error("Error during detailed health check:", error);

      const response: ApiResponse = {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date(),
      };

      res.status(500).json(response);
    }
  },
);

// Readiness check endpoint (for Kubernetes/liveness probes)
router.get(
  "/ready",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log("Performing readiness check");

      // Check critical services only
      const mongoHealth = await mongoConnection.healthCheck();
      const modelHealth = await checkModelHealth();

      const isReady = mongoHealth.status === "healthy" && modelHealth.healthy;

      const readinessInfo = {
        ready: isReady,
        checks: {
          mongodb: mongoHealth.status === "healthy",
          model: modelHealth.healthy,
        },
        timestamp: new Date(),
      };

      const response: ApiResponse = {
        success: isReady,
        data: readinessInfo,
        timestamp: new Date(),
      };

      const statusCode = isReady ? 200 : 503;

      console.log("Readiness check completed:", { ready: isReady });

      res.status(statusCode).json(response);
    } catch (error) {
      console.error("Error during readiness check:", error);

      const response: ApiResponse = {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date(),
      };

      res.status(503).json(response);
    }
  },
);

// Liveness check endpoint (for Kubernetes/liveness probes)
router.get("/live", async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("Performing liveness check");

    // Basic liveness check - just check if the process is running
    const livenessInfo = {
      alive: true,
      uptime: process.uptime(),
      timestamp: new Date(),
    };

    const response: ApiResponse = {
      success: true,
      data: livenessInfo,
      timestamp: new Date(),
    };

    console.log("Liveness check completed");

    res.json(response);
  } catch (error) {
    console.error("Error during liveness check:", error);

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      timestamp: new Date(),
    };

    res.status(503).json(response);
  }
});

// Get service health details
async function getServiceHealthDetails(): Promise<any[]> {
  const services = [];

  // MongoDB details
  try {
    const mongoHealth = await mongoConnection.healthCheck();
    const mongoService: any = {
      name: "mongodb",
      status: mongoHealth.status,
      details: {
        connected: mongoConnection.getConnectionStatus(),
        uri: config.MONGODB_URI.replace(/\/\/.*@/, "//***:***@"), // Hide credentials
      },
    };
    if (mongoHealth.responseTime !== undefined) {
      mongoService.responseTime = mongoHealth.responseTime;
    }
    if (mongoHealth.error !== undefined) {
      mongoService.error = mongoHealth.error;
    }
    services.push(mongoService);
  } catch (error) {
    services.push({
      name: "mongodb",
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  // Model adapter details
  try {
    const modelHealth = await checkModelHealth();
    const { getModelInfo } = require("../../models");
    const modelInfo = await getModelInfo();

    const modelService: any = {
      name: "model-adapter",
      status: modelHealth.healthy ? "healthy" : "unhealthy",
      details: {
        provider: modelInfo.provider,
        model: modelInfo.model,
        capabilities: modelInfo.capabilities,
      },
    };
    if (modelHealth.error !== undefined) {
      modelService.error = modelHealth.error;
    }
    services.push(modelService);
  } catch (error) {
    services.push({
      name: "model-adapter",
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return services;
}

// Check memory usage
function checkMemoryUsage(): ServiceHealth {
  const memoryUsage = process.memoryUsage();
  const totalMemory = memoryUsage.heapTotal;
  const usedMemory = memoryUsage.heapUsed;
  const memoryUsagePercent = (usedMemory / totalMemory) * 100;

  // Consider unhealthy if memory usage is above 90%
  const isHealthy = memoryUsagePercent < 90;

  const memoryService: ServiceHealth = {
    name: "memory",
    status: isHealthy ? "healthy" : "unhealthy",
    responseTime: 0, // Memory check is instantaneous
  };

  if (!isHealthy) {
    memoryService.error = `Memory usage is ${memoryUsagePercent.toFixed(2)}%`;
  }

  return memoryService;
}

// Check disk space (basic check)
function checkDiskSpace(): ServiceHealth {
  // This is a simplified check - in production you'd want to use a proper disk space check
  // For now, we'll just return healthy since we can't easily check disk space in Node.js
  return {
    name: "disk",
    status: "healthy",
    responseTime: 0,
  };
}

// Export the router
export { router as healthRouter };
