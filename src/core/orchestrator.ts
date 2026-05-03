import {
  CopilotRunRequest,
  CopilotRunResponse,
  Intent,
  Conversation,
  ConversationMessage,
} from "../types"; // Import relevant types
import { getModelAdapter } from "../models"; // Import model adapter
import { conversationRepository } from "../memory/conversation.repo"; // Import conversation repository
import { SystemPromptBuilder } from "../prompts/system.prompt"; // Import system prompt builder
import { ChatPromptBuilder } from "../prompts/chat.prompt"; // Import chat prompt builder
import { StateUpdateBuilder } from "../prompts/state.prompt"; // Import state update builder
import { toolManager } from "../tools"; // Import tool manager
import { v4 as uuidv4 } from "uuid"; // Import UUID generator

// Main orchestrator class for processing AI Copilot requests
export class Orchestrator {
  private modelAdapter = getModelAdapter(); // Get the configured model adapter

  // Process a user request through the complete AI pipeline
  async processRequest(
    request: CopilotRunRequest,
  ): Promise<CopilotRunResponse> {
    const startTime = Date.now(); // Track processing time

    try {
      console.log("Processing AI Copilot request:", {
        message: request.message,
        conversationId: request.conversationId,
      });

      // Step 1: Validate input
      const validationResult = this.validateRequest(request);
      if (!validationResult.valid) {
        throw new Error(
          `Invalid request: ${validationResult.errors.join(", ")}`,
        );
      }

      // Step 2: Handle conversation management
      const conversation = await this.handleConversation(
        request.conversationId,
      );

      // Step 3: Save user message
      const userMessage = await this.saveUserMessage(
        conversation.id,
        request.message,
      );

      // Step 4: Get conversation history
      const conversationHistory = await this.getConversationHistory(
        conversation.id,
      );

      // Step 5: Detect intent
      const intent = await this.detectIntent(
        request.message,
        conversationHistory,
      );

      // Step 6: Execute tools if needed
      let toolResults: any[] = [];
      if (intent.type === "tool" && intent.toolName) {
        toolResults = await this.executeTools(intent, request.context);
      }

      // Step 7: Build prompt
      const prompt = await this.buildPrompt(
        request.message,
        conversationHistory,
        conversation,
        request.context,
        toolResults,
      );

      // Step 8: Generate response
      const response = await this.generateResponse(prompt);

      // Step 9: Save assistant response
      await this.saveAssistantMessage(conversation.id, response);

      // Step 10: Update conversation
      await this.updateConversation(conversation.id);

      // Step 11: Optional state update
      if (this.shouldPerformStateUpdate(intent)) {
        await this.performStateUpdate(
          request.message,
          conversationHistory,
          conversation.id,
        );
      }

      const processingTime = Date.now() - startTime;

      console.log("Request processed successfully:", {
        conversationId: conversation.id,
        processingTime,
        intent: intent.type,
        toolsUsed: toolResults.length,
      });

      return {
        response,
        conversationId: conversation.id,
        metadata: {
          processingTime,
          intent: intent.type,
          toolsUsed: toolResults.map((result) => result.toolName),
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error("Error processing request:", error);

      throw new Error(
        `Orchestrator processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Validate the incoming request
  private validateRequest(request: CopilotRunRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!request.message || typeof request.message !== "string") {
      errors.push("Message is required and must be a string");
    }

    if (request.message && request.message.trim().length === 0) {
      errors.push("Message cannot be empty");
    }

    if (request.message && request.message.length > 10000) {
      errors.push("Message is too long (maximum 10,000 characters)");
    }

    if (request.conversationId && typeof request.conversationId !== "string") {
      errors.push("Conversation ID must be a string");
    }

    if (request.context && typeof request.context !== "object") {
      errors.push("Context must be an object");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Handle conversation creation or retrieval
  private async handleConversation(
    conversationId?: string,
  ): Promise<Conversation> {
    if (conversationId) {
      // Try to find existing conversation
      const existingConversation =
        await conversationRepository.findById(conversationId);

      if (existingConversation) {
        // Update the conversation's last activity
        await conversationRepository.update(conversationId, {
          updatedAt: new Date(),
        });
        return existingConversation;
      }
    }

    // Create new conversation
    const newConversation = await conversationRepository.create({
      messages: [],
      metadata: {
        source: "api",
        context: {},
      },
    });

    console.log("Created new conversation:", newConversation.id);
    return newConversation;
  }

  // Save user message to database
  private async saveUserMessage(
    conversationId: string,
    message: string,
  ): Promise<ConversationMessage> {
    const userMessage = await conversationRepository.addMessage(
      conversationId,
      {
        role: "user",
        content: message,
        metadata: {
          tokens: this.estimateTokens(message),
        },
      },
    );

    if (!userMessage) {
      throw new Error("Failed to save user message");
    }

    return userMessage;
  }

  // Save assistant response to database
  private async saveAssistantMessage(
    conversationId: string,
    response: string,
  ): Promise<ConversationMessage> {
    const assistantMessage = await conversationRepository.addMessage(
      conversationId,
      {
        role: "assistant",
        content: response,
        metadata: {
          tokens: this.estimateTokens(response),
        },
      },
    );

    if (!assistantMessage) {
      throw new Error("Failed to save assistant message");
    }

    return assistantMessage;
  }

  // Get conversation history for a conversation
  private async getConversationHistory(
    conversationId: string,
    limit: number = 20,
  ): Promise<ConversationMessage[]> {
    const messages = await conversationRepository.getMessages(conversationId);
    return messages.slice(-limit); // Return last N messages
  }

  // Update conversation timestamp
  private async updateConversation(conversationId: string): Promise<void> {
    await conversationRepository.update(conversationId, {
      updatedAt: new Date(),
    });
  }

  // Detect user intent from message and context
  private async detectIntent(
    message: string,
    history: ConversationMessage[],
  ): Promise<Intent> {
    // Simple rule-based intent detection (can be enhanced with ML)
    const lowerMessage = message.toLowerCase();

    // Check for tool-related keywords
    const toolKeywords = {
      "read file": "readFile",
      "write file": "writeFile",
      "list files": "listFiles",
      "delete file": "deleteFile",
      "get user": "getUserData",
      "update preferences": "updateUserPreferences",
      "session history": "getUserSessionHistory",
    };

    for (const [keyword, toolName] of Object.entries(toolKeywords)) {
      if (lowerMessage.includes(keyword)) {
        return {
          type: "tool",
          confidence: 0.8,
          parameters: { toolName },
          toolName,
        };
      }
    }

    // Check for state update needs
    const stateUpdateKeywords = [
      "remember",
      "save",
      "preference",
      "setting",
      "profile",
    ];
    if (stateUpdateKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      return {
        type: "hybrid",
        confidence: 0.7,
        parameters: { needsStateUpdate: true },
      };
    }

    // Default to chat intent
    return {
      type: "chat",
      confidence: 0.9,
    };
  }

  // Execute tools based on intent
  private async executeTools(intent: Intent, context?: any): Promise<any[]> {
    const results: any[] = [];

    if (intent.type === "tool" && intent.toolName) {
      try {
        const tool = toolManager.getTool(intent.toolName);

        if (tool) {
          const toolInput = this.prepareToolInput(intent, context);
          const result = await toolManager.executeTool(
            intent.toolName,
            toolInput,
          );

          results.push({
            toolName: intent.toolName,
            success: true,
            result,
          });
        } else {
          results.push({
            toolName: intent.toolName,
            success: false,
            error: "Tool not found",
          });
        }
      } catch (error) {
        results.push({
          toolName: intent.toolName,
          success: false,
          error: error instanceof Error ? error.message : "Unknown tool error",
        });
      }
    }

    return results;
  }

  // Prepare input for tool execution
  private prepareToolInput(intent: Intent, context?: any): any {
    // This would parse the user message to extract tool parameters
    // For now, return basic context
    return {
      ...context,
      ...intent.parameters,
    };
  }

  // Build the complete prompt for the model
  private async buildPrompt(
    userMessage: string,
    history: ConversationMessage[],
    conversation: Conversation,
    context?: any,
    toolResults?: any[],
  ): Promise<string> {
    // Build system prompt
    const systemPrompt = SystemPromptBuilder.buildPrompt(
      context?.taskType,
      context?.taskContext,
      {
        sessionId: conversation.id,
        messageCount: conversation.messages.length.toString(),
        source: conversation.metadata?.source || "unknown",
      },
    );

    // Add tool results to context if available
    let additionalContext = "";
    if (toolResults && toolResults.length > 0) {
      additionalContext = `Tool Results:\n${JSON.stringify(toolResults, null, 2)}\n\n`;
    }

    if (context) {
      additionalContext += `Additional Context:\n${JSON.stringify(context, null, 2)}\n\n`;
    }

    // Build chat prompt
    const promptOptions: {
      includeFullHistory: boolean;
      additionalContext?: string;
      sessionId: string;
      messageCount: number;
      sessionDuration: string;
    } = {
      includeFullHistory: conversation.messages.length < 10, // Include full history for new conversations
      sessionId: conversation.id,
      messageCount: conversation.messages.length,
      sessionDuration: this.calculateSessionDuration(conversation),
    };

    // Only include additionalContext if it has a value
    if (additionalContext) {
      promptOptions.additionalContext = additionalContext;
    }

    return ChatPromptBuilder.buildPrompt(
      history,
      userMessage,
      systemPrompt,
      promptOptions,
    );
  }

  // Generate response using the model adapter
  private async generateResponse(prompt: string): Promise<string> {
    try {
      const response = await this.modelAdapter.generateResponse(prompt, {
        provider: this.modelAdapter.getProvider(),
        model: "unknown", // Would need to be added to adapter interface
        temperature: 0.7,
        maxTokens: 2048,
      });

      return response;
    } catch (error) {
      throw new Error(
        `Model generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Determine if state update should be performed
  private shouldPerformStateUpdate(intent: Intent): boolean {
    return (
      intent.type === "hybrid" ||
      (intent.parameters && intent.parameters.needsStateUpdate)
    );
  }

  // Perform state update for entity extraction
  private async performStateUpdate(
    message: string,
    history: ConversationMessage[],
    conversationId: string,
  ): Promise<void> {
    try {
      const stateData = await StateUpdateBuilder.fullStateUpdate(
        message,
        this.buildContextSummary(history),
        this.modelAdapter,
      );

      // Store state data (in a real implementation, this would go to a separate collection)
      console.log(
        "State update completed for conversation:",
        conversationId,
        stateData,
      );
    } catch (error) {
      console.error("State update failed:", error);
      // Don't fail the entire request if state update fails
    }
  }

  // Build context summary from history
  private buildContextSummary(history: ConversationMessage[]): string {
    if (history.length === 0) {
      return "No previous conversation.";
    }

    const recentMessages = history.slice(-5); // Last 5 messages
    return recentMessages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");
  }

  // Calculate session duration
  private calculateSessionDuration(conversation: Conversation): string {
    const duration = Date.now() - conversation.createdAt.getTime();
    const minutes = Math.floor(duration / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }

  // Estimate token count (simple approximation)
  private estimateTokens(text: string): number {
    const words = text.split(/\s+/).length;
    const chars = text.length;

    const tokenByChars = Math.ceil(chars / 4);
    const tokenByWords = Math.ceil(words * 1.3);

    return Math.ceil((tokenByChars + tokenByWords) / 2);
  }

  // Get orchestrator statistics
  async getStats(): Promise<{
    totalConversations: number;
    totalMessages: number;
    modelProvider: string;
    toolCount: number;
  }> {
    const conversationCount = await conversationRepository.count();
    const conversations = await conversationRepository.getAll();
    const totalMessages = conversations.reduce(
      (sum, conv) => sum + conv.messages.length,
      0,
    );

    return {
      totalConversations: conversationCount,
      totalMessages,
      modelProvider: this.modelAdapter.getProvider(),
      toolCount: toolManager.getToolNames().length,
    };
  }
}
