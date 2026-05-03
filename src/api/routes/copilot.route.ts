import { Router, Request, Response, NextFunction } from "express"; // Import Express types
import {
  CopilotRunRequest,
  CopilotRunResponse,
  ApiResponse,
  Tool,
} from "../../types"; // Import relevant types
import { Orchestrator } from "../../core/orchestrator"; // Import Orchestrator class
import { conversationRepository } from "../../memory/conversation.repo"; // Import conversation repository

// Create Express router for copilot routes
const router = Router();

// Global orchestrator instance (will be initialized in server.ts)
let orchestrator: Orchestrator;

// Function to initialize orchestrator (called from server.ts)
export function initializeOrchestrator(): Orchestrator {
  orchestrator = new Orchestrator();
  return orchestrator;
}

// Function to get the orchestrator instance
export function getOrchestrator(): Orchestrator {
  if (!orchestrator) {
    throw new Error(
      "Orchestrator not initialized. Call initializeOrchestrator() first.",
    );
  }
  return orchestrator;
}

// Main copilot run endpoint
router.post("/run", async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("Received copilot run request:", {
      body: req.body,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Validate request body
    const validationResult = validateRunRequest(req.body);
    if (!validationResult.valid) {
      const response: ApiResponse = {
        success: false,
        error: `Invalid request: ${validationResult.errors.join(", ")}`,
        timestamp: new Date(),
      };

      return res.status(400).json(response);
    }

    // Process request with orchestrator
    const result = await getOrchestrator().processRequest(req.body);

    // Create success response
    const response: ApiResponse<CopilotRunResponse> = {
      success: true,
      data: result,
      timestamp: new Date(),
    };

    console.log("Copilot request processed successfully:", {
      sessionId: result.conversationId,
      responseLength: result.response.length,
      metadata: result.metadata,
    });

    res.json(response);
    return;
  } catch (error) {
    console.error("Error in copilot run endpoint:", error);

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      timestamp: new Date(),
    };

    res.status(500).json(response);
    return;
  }
});

// Get conversation history for a session
router.get(
  "/history/:sessionId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const { limit = 50, includeMetadata = "false" } = req.query;

      console.log("Retrieving conversation history:", { sessionId, limit });

      // Validate sessionId
      if (!sessionId || typeof sessionId !== "string") {
        const response: ApiResponse = {
          success: false,
          error: "Valid sessionId is required",
          timestamp: new Date(),
        };

        return res.status(400).json(response);
      }

      // Check if conversation exists
      const conversation = await conversationRepository.findById(sessionId);
      if (!conversation) {
        const response: ApiResponse = {
          success: false,
          error: "Conversation not found",
          timestamp: new Date(),
        };

        return res.status(404).json(response);
      }

      // Get messages for the conversation
      const messageLimit = parseInt(limit as string) || 50;
      const includeMetadataFlag = includeMetadata === "true";

      const messages = await conversationRepository.getMessages(sessionId);
      const limitedMessages = messages.slice(-messageLimit); // Get last N messages

      // Format response
      const historyData = {
        conversationId: sessionId,
        conversationInfo: {
          id: conversation.id,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          messageCount: conversation.messages.length,
          metadata: includeMetadataFlag ? conversation.metadata : undefined,
        },
        messages: includeMetadataFlag
          ? limitedMessages
          : limitedMessages.map((msg) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp,
            })),
        totalMessages: messages.length,
      };

      const response: ApiResponse = {
        success: true,
        data: historyData,
        timestamp: new Date(),
      };

      console.log("Conversation history retrieved successfully:", {
        sessionId,
        messageCount: messages.length,
      });

      res.json(response);
      return;
    } catch (error) {
      console.error("Error retrieving conversation history:", error);

      const response: ApiResponse = {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date(),
      };

      res.status(500).json(response);
      return;
    }
  },
);

// Get session information
router.get(
  "/session/:sessionId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;

      console.log("Retrieving session information:", { sessionId });

      // Validate sessionId
      if (!sessionId || typeof sessionId !== "string") {
        const response: ApiResponse = {
          success: false,
          error: "Valid sessionId is required",
          timestamp: new Date(),
        };

        return res.status(400).json(response);
      }

      // Get conversation information
      const conversation = await conversationRepository.findById(sessionId);
      if (!conversation) {
        const response: ApiResponse = {
          success: false,
          error: "Conversation not found",
          timestamp: new Date(),
        };

        return res.status(404).json(response);
      }

      // Get message count for this conversation
      const messageCount = conversation.messages.length;

      const conversationData = {
        id: conversation.id,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messageCount,
        metadata: conversation.metadata,
        duration: calculateSessionDuration(conversation),
      };

      const response: ApiResponse = {
        success: true,
        data: conversationData,
        timestamp: new Date(),
      };

      console.log("Conversation information retrieved successfully:", {
        sessionId,
      });

      res.json(response);
      return;
    } catch (error) {
      console.error("Error retrieving session information:", error);

      const response: ApiResponse = {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date(),
      };

      res.status(500).json(response);
      return;
    }
  },
);

// Delete a session and all its messages
router.delete(
  "/session/:sessionId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;

      console.log("Deleting session:", { sessionId });

      // Validate sessionId
      if (!sessionId || typeof sessionId !== "string") {
        const response: ApiResponse = {
          success: false,
          error: "Valid sessionId is required",
          timestamp: new Date(),
        };

        return res.status(400).json(response);
      }

      // Check if conversation exists
      const conversation = await conversationRepository.findById(sessionId);
      if (!conversation) {
        const response: ApiResponse = {
          success: false,
          error: "Conversation not found",
          timestamp: new Date(),
        };

        return res.status(404).json(response);
      }

      // Delete the conversation (this will delete all messages since they're embedded)
      const conversationDeleted =
        await conversationRepository.delete(sessionId);

      if (!conversationDeleted) {
        throw new Error("Failed to delete conversation");
      }

      const deleteResult = {
        conversationId: sessionId,
        deletedMessagesCount: conversation.messages.length,
        conversationDeleted: true,
      };

      const response: ApiResponse = {
        success: true,
        data: deleteResult,
        timestamp: new Date(),
      };

      console.log("Conversation deleted successfully:", {
        conversationId: sessionId,
        deletedMessagesCount: conversation.messages.length,
      });

      res.json(response);
      return;
    } catch (error) {
      console.error("Error deleting conversation:", error);

      const response: ApiResponse = {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date(),
      };

      res.status(500).json(response);
      return;
    }
  },
);

// Get available tools
router.get(
  "/tools",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log("Retrieving available tools");

      // Get tool manager instance
      const { toolManager } = require("../../tools");

      const tools = toolManager.getAllTools();
      const toolNames = toolManager.getToolNames();

      const toolsData = {
        availableTools: toolNames,
        toolDetails: Object.entries(tools as Record<string, Tool>).map(
          ([name, tool]) => ({
            name,
            description: tool.description,
          }),
        ),
        totalTools: toolNames.length,
      };

      const response: ApiResponse = {
        success: true,
        data: toolsData,
        timestamp: new Date(),
      };

      console.log("Available tools retrieved successfully:", {
        toolCount: toolNames.length,
      });

      res.json(response);
      return;
    } catch (error) {
      console.error("Error retrieving available tools:", error);

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

// Get orchestrator statistics
router.get(
  "/stats",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log("Retrieving orchestrator statistics");

      const stats = await getOrchestrator().getStats();

      const response: ApiResponse = {
        success: true,
        data: stats,
        timestamp: new Date(),
      };

      console.log("Orchestrator statistics retrieved successfully:", stats);

      res.json(response);
      return;
    } catch (error) {
      console.error("Error retrieving orchestrator statistics:", error);

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

// Validate run request
function validateRunRequest(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (!body.message || typeof body.message !== "string") {
    errors.push("message field is required and must be a string");
  }

  if (body.message && body.message.trim().length === 0) {
    errors.push("message cannot be empty");
  }

  if (body.message && body.message.length > 10000) {
    errors.push("message is too long (maximum 10,000 characters)");
  }

  // Check optional fields
  if (body.sessionId && typeof body.sessionId !== "string") {
    errors.push("sessionId must be a string");
  }

  if (body.context && typeof body.context !== "object") {
    errors.push("context must be an object");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Calculate session duration
function calculateSessionDuration(session: any): string {
  const duration = Date.now() - session.createdAt.getTime();
  const minutes = Math.floor(duration / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else {
    return `${minutes}m`;
  }
}

// Export the router
export { router as copilotRouter };
