// Core types and interfaces for the AI Copilot backend service

// ===== CONVERSATION TYPES =====

// Represents a message within a conversation
export interface ConversationMessage {
  id: string; // Unique identifier for the message
  role: "user" | "assistant" | "system"; // Who sent the message
  content: string; // Message content
  timestamp: Date; // When the message was created
  metadata?: MessageMetadata; // Optional metadata about the message
}

// Metadata for messages (tokens, model info, etc.)
export interface MessageMetadata {
  tokens?: number; // Number of tokens in the message
  model?: string; // Model used to generate the response
  processingTime?: number; // Time taken to process in milliseconds
  flags?: string[]; // Any special flags or markers
}

// Represents a complete conversation with all messages
export interface Conversation {
  id: string; // Unique conversation identifier
  createdAt: Date; // When the conversation was created
  updatedAt: Date; // When the conversation was last updated
  messages: ConversationMessage[]; // All messages in this conversation
  metadata?: ConversationMetadata; // Optional conversation metadata
}

// Metadata for conversations
export interface ConversationMetadata {
  userId?: string; // User identifier if available
  source?: string; // Where the conversation originated from
  context?: Record<string, any>; // Additional context data
  title?: string; // Optional conversation title
}

// ===== API REQUEST/RESPONSE TYPES =====

// Request payload for the copilot run endpoint
export interface CopilotRunRequest {
  message: string; // User's message
  conversationId?: string; // Optional existing conversation ID
  context?: Record<string, any>; // Optional additional context
}

// Response payload for the copilot run endpoint
export interface CopilotRunResponse {
  response: string; // Assistant's response
  conversationId: string; // Conversation ID (new or existing)
  metadata?: ResponseMetadata; // Optional response metadata
}

// Metadata for API responses
export interface ResponseMetadata {
  tokens?: number; // Tokens used in response
  processingTime?: number; // Total processing time
  intent?: string; // Detected intent
  toolsUsed?: string[]; // Tools that were used
}

// ===== MODEL ADAPTER TYPES =====

// Configuration for model providers
export interface ModelConfig {
  provider: string; // Model provider (gemini, openai, etc.)
  model: string; // Specific model name
  temperature?: number; // Temperature for generation (0-1)
  maxTokens?: number; // Maximum tokens to generate
  apiKey?: string; // API key for the provider
}

// Base interface for all model adapters
export interface ModelAdapter {
  // Generate a response from the model
  generateResponse(prompt: string, config: ModelConfig): Promise<string>;

  // Get provider name
  getProvider(): string;

  // Health check for the adapter
  healthCheck(): Promise<boolean>;
}

// ===== TOOL SYSTEM TYPES =====

// Interface for tools that can be called by the orchestrator
export interface Tool {
  name: string; // Unique tool name
  description: string; // What the tool does
  execute: (input: any) => Promise<any>; // Tool execution function
  isSensitivePath?: (filePath: string) => boolean; // Optional security check method
}

// Registry of available tools
export interface ToolRegistry {
  [toolName: string]: Tool; // Map of tool names to tool implementations
}

// ===== INTENT DETECTION TYPES =====

// Detected user intent
export interface Intent {
  type: string; // Intent type (chat, tool, hybrid)
  confidence: number; // Confidence score (0-1)
  parameters?: Record<string, any>; // Extracted parameters
  toolName?: string; // Tool to call if applicable
}

// ===== PROMPT SYSTEM TYPES =====

// Different types of prompts
export type PromptType = "system" | "chat" | "state";

// Prompt template interface
export interface PromptTemplate {
  type: PromptType; // Type of prompt
  template: string; // Prompt template with placeholders
  variables?: string[]; // Expected variables in template
}

// ===== MEMORY SYSTEM TYPES =====

// Database connection configuration
export interface DatabaseConfig {
  uri: string; // MongoDB connection URI
  database: string; // Database name
  options?: Record<string, any>; // Additional connection options
}

// Repository interface for data access
export interface Repository<T> {
  create(data: Partial<T>): Promise<T>;
  findById(id: string): Promise<T | null>;
  find(filter: Record<string, any>): Promise<T[]>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}

// ===== ERROR TYPES =====

// Custom error class for application errors
export class CopilotError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = "CopilotError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ===== CONFIGURATION TYPES =====

// Environment configuration interface
export interface EnvConfig {
  PORT: number; // Server port
  MONGODB_URI: string; // MongoDB connection string
  MODEL_PROVIDER: string; // Model provider to use
  MODEL_NAME: string; // Model name to use
  GEMINI_API_KEY?: string | undefined; // Gemini API key (if using Gemini)
  OPENAI_API_KEY?: string | undefined; // OpenAI API key (if using OpenAI)
  MAX_TOKENS: number; // Maximum tokens for responses
  TEMPERATURE: number; // Temperature for model generation
  LOG_LEVEL: string; // Logging level
}

// ===== UTILITY TYPES =====

// Generic API response wrapper
export interface ApiResponse<T = any> {
  success: boolean; // Whether the request was successful
  data?: T; // Response data
  error?: string; // Error message if failed
  timestamp: Date; // Response timestamp
}

// Health check response
export interface HealthResponse {
  status: "healthy" | "unhealthy"; // Service health status
  timestamp: Date; // Check timestamp
  services: ServiceHealth[]; // Health of individual services
}

// Individual service health
export interface ServiceHealth {
  name: string; // Service name
  status: "healthy" | "unhealthy"; // Service status
  responseTime?: number; // Response time in milliseconds
  error?: string; // Error message if unhealthy
}
