import { GoogleGenAI } from "@google/genai"; // Import Google GenAI
import { BaseModelAdapter } from "./base"; // Import base adapter
import { ModelConfig } from "../types"; // Import ModelConfig type

// Gemini model adapter implementation
export class GeminiAdapter extends BaseModelAdapter {
  private genAI: GoogleGenAI; // Google GenAI client

  constructor(config: ModelConfig) {
    super(config); // Call parent constructor

    // Validate configuration
    this.validateConfig();

    // Initialize Google GenAI client
    this.genAI = new GoogleGenAI({});
  }

  // Generate response using Gemini API
  async generateResponse(prompt: string, config: ModelConfig): Promise<string> {
    try {
      // Sanitize and validate the prompt
      const sanitizedPrompt = this.sanitizePrompt(prompt);

      // Merge configuration with defaults
      const finalConfig = this.mergeConfig(config);

      // Generate content with Gemini using new API
      const response = await this.genAI.models.generateContent({
        model: this.config.model!,
        contents: sanitizedPrompt,
      });

      // Extract the text response
      const textResponse = response.text;

      // Apply token limits if necessary
      const limitedResponse = this.applyTokenLimit(
        textResponse || "",
        finalConfig.maxTokens!,
      );

      // Estimate tokens for logging
      const estimatedTokens = this.estimateTokens(limitedResponse);

      // Log usage for monitoring
      this.logUsage(sanitizedPrompt, limitedResponse, estimatedTokens);

      return limitedResponse;
    } catch (error) {
      // Extract error information
      const errorInfo = this.extractErrorInfo(error);

      // Throw a more descriptive error
      throw new Error(
        `Gemini API error: ${errorInfo.message}${errorInfo.code ? ` (Code: ${errorInfo.code})` : ""}`,
      );
    }
  }

  // Health check specific to Gemini
  async healthCheck(): Promise<boolean> {
    try {
      // Try to generate a very simple response
      const testPrompt = "Respond with just 'OK'";
      const result = await this.genAI.models.generateContent({
        model: this.config.model!,
        contents: testPrompt,
      });
      const response = result.text;

      // Check if we got a valid response
      return response ? response.length > 0 : false;
    } catch (error) {
      return false; // Health check failed
    }
  }

  // Validate Gemini-specific configuration
  protected validateConfig(): void {
    // Call parent validation
    super.validateConfig();

    // Gemini-specific validations
    if (this.config.provider !== "gemini") {
      throw new Error('Provider must be "gemini" for GeminiAdapter');
    }

    // Validate API key format (Gemini keys typically start with specific patterns)
    if (this.config.apiKey && !this.isValidGeminiApiKey(this.config.apiKey)) {
      throw new Error("Invalid Gemini API key format");
    }

    // Validate model name
    if (this.config.model && !this.isValidGeminiModel(this.config.model)) {
      throw new Error(
        `Invalid Gemini model: ${this.config.model}. Valid models: gemini-1.5-pro, gemini-1.5-flash, gemini-pro, etc.`,
      );
    }
  }

  // Get Gemini-specific default configuration
  protected getDefaultConfig(): Partial<ModelConfig> {
    return {
      ...super.getDefaultConfig(), // Get parent defaults
      temperature: 0.7, // Default temperature for Gemini
      maxTokens: 2048, // Default max tokens
    };
  }

  // Check if API key format is valid for Gemini
  private isValidGeminiApiKey(apiKey: string): boolean {
    // Gemini API keys are typically long alphanumeric strings
    // This is a basic format check - in reality, you'd want more sophisticated validation
    return (
      typeof apiKey === "string" &&
      apiKey.length > 20 &&
      /^[a-zA-Z0-9_-]+$/.test(apiKey)
    );
  }

  // Check if model name is valid for Gemini
  private isValidGeminiModel(model: string): boolean {
    const validModels = [
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "gemini-pro",
      "gemini-pro-vision",
      "gemini-1.0-pro",
    ];

    return validModels.includes(model) || model.startsWith("gemini-"); // Allow any model starting with 'gemini-'
  }

  // Generate content with specific generation config
  private async generateContentWithConfig(
    prompt: string,
    config: ModelConfig,
  ): Promise<any> {
    // Build generation configuration
    const generationConfig: any = {};

    if (config.temperature !== undefined) {
      generationConfig.temperature = config.temperature;
    }

    if (config.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = config.maxTokens;
    }

    // Add other Gemini-specific parameters if needed
    generationConfig.candidateCount = 1; // Generate only one response
    generationConfig.stopSequences = []; // No stop sequences by default

    try {
      // Generate content with configuration using new API
      const result = await this.genAI.models.generateContent({
        model: this.config.model!,
        contents: prompt,
      });

      return result;
    } catch (error) {
      // Handle specific Gemini errors
      if (this.isGeminiQuotaError(error)) {
        throw new Error(
          "Gemini API quota exceeded. Please check your billing and usage limits.",
        );
      }

      if (this.isGeminiSafetyError(error)) {
        throw new Error(
          "Content was blocked by Gemini safety filters. Please try rephrasing your request.",
        );
      }

      // Re-throw other errors
      throw error;
    }
  }

  // Check if error is related to quota limits
  private isGeminiQuotaError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message || error.toString();
    return (
      errorMessage.toLowerCase().includes("quota") ||
      errorMessage.toLowerCase().includes("billing") ||
      errorMessage.toLowerCase().includes("limit exceeded")
    );
  }

  // Check if error is related to safety filters
  private isGeminiSafetyError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message || error.toString();
    return (
      errorMessage.toLowerCase().includes("safety") ||
      errorMessage.toLowerCase().includes("blocked") ||
      errorMessage.toLowerCase().includes("content policy")
    );
  }

  // Extract error information specific to Gemini
  protected extractErrorInfo(error: any): { message: string; code?: string } {
    // Try to get Gemini-specific error information
    if (error && typeof error === "object") {
      // Check for Gemini API error structure
      if (error.status && error.status.code && error.status.message) {
        return {
          message: error.status.message,
          code: String(error.status.code),
        };
      }

      // Check for response errors
      if (error.response && error.response.data) {
        const data = error.response.data;
        return {
          message: data.error?.message || data.message || "Gemini API error",
          code: data.error?.code || data.code,
        };
      }
    }

    // Fall back to parent error extraction
    return super.extractErrorInfo(error);
  }

  // Get model capabilities and information
  async getModelInfo(): Promise<{
    name: string;
    provider: string;
    maxTokens: number;
    supportedFeatures: string[];
  }> {
    return {
      name: this.config.model,
      provider: "gemini",
      maxTokens: 8192, // Gemini's typical max output tokens
      supportedFeatures: [
        "text-generation",
        "conversation",
        "safety-filters",
        "temperature-control",
        "token-limiting",
      ],
    };
  }

  // Test the connection with a simple request
  async testConnection(): Promise<{
    success: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Send a simple test request
      const testPrompt = "Hello";
      await this.generateResponse(testPrompt, this.config);

      const latency = Date.now() - startTime;

      return { success: true, latency };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return {
        success: false,
        latency,
        error: errorMessage,
      };
    }
  }
}
