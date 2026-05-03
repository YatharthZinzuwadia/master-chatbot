import { PromptTemplate } from "../types"; // Import PromptTemplate type
import { ConversationMessage } from "../types"; // Import ConversationMessage type

// Chat prompt template for conversation context
export const chatPromptTemplate: PromptTemplate = {
  type: "chat",
  template: `{{systemPrompt}}

Conversation History:
{{conversationHistory}}

Current Context:
{{currentContext}}

User Message: {{userMessage}}

Please provide a helpful and relevant response to the user's message.`,
  variables: [
    "systemPrompt",
    "conversationHistory",
    "currentContext",
    "userMessage",
  ],
};

// Simple chat prompt for quick responses
export const simpleChatPrompt: PromptTemplate = {
  type: "chat",
  template: `{{systemPrompt}}

Recent conversation:
{{recentHistory}}

User: {{userMessage}}

Assistant: `,
  variables: ["systemPrompt", "recentHistory", "userMessage"],
};

// Context-aware chat prompt
export const contextAwarePrompt: PromptTemplate = {
  type: "chat",
  template: `{{systemPrompt}}

Session Information:
- Session ID: {{sessionId}}
- Message Count: {{messageCount}}
- Session Duration: {{sessionDuration}}

Relevant Context:
{{additionalContext}}

Conversation:
{{conversationHistory}}

Current Request: {{userMessage}}

Instructions:
1. Consider the conversation history and context
2. Provide a relevant and helpful response
3. Be concise but thorough
4. Maintain conversation continuity`,
  variables: [
    "systemPrompt",
    "sessionId",
    "messageCount",
    "sessionDuration",
    "additionalContext",
    "conversationHistory",
    "userMessage",
  ],
};

// Chat prompt builder class
export class ChatPromptBuilder {
  // Build chat prompt from messages and context
  static buildPrompt(
    messages: ConversationMessage[],
    userMessage: string,
    systemPrompt: string,
    options?: {
      includeFullHistory?: boolean;
      maxHistoryLength?: number;
      additionalContext?: string;
      sessionId?: string;
      messageCount?: number;
      sessionDuration?: string;
    },
  ): string {
    const {
      includeFullHistory = false,
      maxHistoryLength = 10,
      additionalContext = "",
      sessionId = "",
      messageCount = 0,
      sessionDuration = "",
    } = options || {};

    // Filter messages based on options
    const filteredMessages = this.filterMessages(messages, {
      includeFullHistory,
      maxHistoryLength,
    });

    // Build conversation history
    const conversationHistory = this.buildConversationHistory(
      filteredMessages,
      {
        includeFullHistory,
        maxHistoryLength,
      },
    );

    // Build recent history for simple prompts
    const recentHistory = this.buildRecentHistory(filteredMessages, 5);

    // Select template based on options
    let template: PromptTemplate;
    if (additionalContext || sessionId) {
      template = contextAwarePrompt;
    } else if (includeFullHistory) {
      template = chatPromptTemplate;
    } else {
      template = simpleChatPrompt;
    }

    // Prepare variables
    const variables = {
      systemPrompt,
      conversationHistory,
      recentHistory,
      currentContext: additionalContext || "No additional context provided.",
      userMessage,
      sessionId,
      messageCount: messageCount.toString(),
      sessionDuration: sessionDuration || "Unknown",
      additionalContext:
        additionalContext || "No additional context available.",
    };

    // Replace variables in template
    return this.replaceVariables(template.template, variables);
  }

  // Filter messages based on options
  private static filterMessages(
    messages: ConversationMessage[],
    options: {
      includeFullHistory: boolean;
      maxHistoryLength: number;
    },
  ): ConversationMessage[] {
    if (options.includeFullHistory) {
      return messages;
    }

    return messages.slice(-options.maxHistoryLength);
  }

  // Build conversation history string
  private static buildConversationHistory(
    messages: ConversationMessage[],
    options: {
      includeFullHistory: boolean;
      maxHistoryLength: number;
    },
  ): string {
    if (messages.length === 0) {
      return "No previous messages.";
    }

    // Format each message
    const formattedMessages = messages.map((msg) => {
      const timestamp = msg.timestamp.toLocaleTimeString();
      return `[${timestamp}] ${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}: ${msg.content}`;
    });

    return formattedMessages.join("\n");
  }

  // Build recent history for simple prompts
  private static buildRecentHistory(
    messages: ConversationMessage[],
    count: number,
  ): string {
    const recentMessages = messages.slice(-count);

    if (recentMessages.length === 0) {
      return "No recent messages.";
    }

    return recentMessages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");
  }

  // Replace template variables with actual values
  private static replaceVariables(
    template: string,
    variables: Record<string, string>,
  ): string {
    let result = template;

    // Replace each variable in the template
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, "g"), value);
    }

    return result;
  }

  // Estimate token count for the prompt
  static estimateTokens(prompt: string): number {
    // Simple token estimation (rough approximation)
    const words = prompt.split(/\s+/).length;
    const chars = prompt.length;

    // Estimate: ~1 token per 4 characters or ~1.3 tokens per word
    const tokenByChars = Math.ceil(chars / 4);
    const tokenByWords = Math.ceil(words * 1.3);

    // Take the average of both estimates
    return Math.ceil((tokenByChars + tokenByWords) / 2);
  }

  // Truncate conversation history to fit within token limits
  static truncateHistory(
    messages: ConversationMessage[],
    maxTokens: number,
  ): ConversationMessage[] {
    let totalTokens = 0;
    const truncatedMessages: ConversationMessage[] = [];

    // Process messages from newest to oldest
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (!message) continue; // Skip undefined messages
      const messageTokens = this.estimateTokens(
        `${message.role}: ${message.content}`,
      );

      if (totalTokens + messageTokens <= maxTokens) {
        truncatedMessages.unshift(message);
        totalTokens += messageTokens;
      } else {
        break; // Stop when we exceed the limit
      }
    }

    return truncatedMessages;
  }

  // Format messages for different model requirements
  static formatMessagesForModel(
    messages: ConversationMessage[],
    modelProvider: string,
  ): string {
    switch (modelProvider.toLowerCase()) {
      case "gemini":
        return this.formatForGemini(messages);

      case "openai":
        return this.formatForOpenAI(messages);

      default:
        return this.buildConversationHistory(messages, {
          includeFullHistory: true,
          maxHistoryLength: messages.length,
        });
    }
  }

  // Format messages for Gemini
  private static formatForGemini(messages: ConversationMessage[]): string {
    return messages
      .map((msg) => {
        const role = msg.role === "assistant" ? "model" : msg.role;
        return `${role}: ${msg.content}`;
      })
      .join("\n");
  }

  // Format messages for OpenAI
  private static formatForOpenAI(messages: ConversationMessage[]): string {
    return messages
      .map((msg) => {
        const role = msg.role === "assistant" ? "assistant" : msg.role;
        return `${role}: ${msg.content}`;
      })
      .join("\n");
  }

  // Add system message to the beginning of conversation
  static addSystemMessage(
    messages: ConversationMessage[],
    systemPrompt: string,
  ): ConversationMessage[] {
    const systemMessage: ConversationMessage = {
      id: "system-" + Date.now(),
      role: "system",
      content: systemPrompt,
      timestamp: new Date(),
    };

    return [systemMessage, ...messages];
  }

  // Validate prompt before sending to model
  static validatePrompt(
    prompt: string,
    maxTokens?: number,
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!prompt || prompt.trim().length === 0) {
      issues.push("Prompt cannot be empty");
    }

    if (prompt.length > 100000) {
      issues.push("Prompt is too long (max 100,000 characters)");
    }

    if (maxTokens) {
      const estimatedTokens = this.estimateTokens(prompt);
      if (estimatedTokens > maxTokens) {
        issues.push(
          `Prompt exceeds token limit (estimated: ${estimatedTokens}, max: ${maxTokens})`,
        );
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
