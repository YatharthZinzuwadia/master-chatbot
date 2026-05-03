import { ModelAdapter, ModelConfig } from '../types';  // Import relevant types

// Abstract base class for all model adapters
export abstract class BaseModelAdapter implements ModelAdapter {
  protected config: ModelConfig;  // Configuration for this adapter

  constructor(config: ModelConfig) {
    this.config = config;  // Store configuration
  }

  // Abstract method that must be implemented by all adapters
  abstract generateResponse(prompt: string, config: ModelConfig): Promise<string>;

  // Get the provider name for this adapter
  getProvider(): string {
    return this.config.provider;  // Return provider from config
  }

  // Default health check implementation (can be overridden)
  async healthCheck(): Promise<boolean> {
    try {
      // Default health check - try to generate a simple response
      const testPrompt = "Hello";
      await this.generateResponse(testPrompt, this.config);
      return true;  // If successful, return healthy
    } catch (error) {
      return false;  // If failed, return unhealthy
    }
  }

  // Validate configuration before use
  protected validateConfig(): void {
    if (!this.config.provider) {
      throw new Error('Model provider is required');
    }
    
    if (!this.config.model) {
      throw new Error('Model name is required');
    }
    
    if (!this.config.apiKey) {
      throw new Error('API key is required');
    }
  }

  // Get default configuration values
  protected getDefaultConfig(): Partial<ModelConfig> {
    return {
      temperature: 0.7,    // Default temperature
      maxTokens: 2048,      // Default max tokens
    };
  }

  // Merge user config with defaults
  protected mergeConfig(userConfig: ModelConfig): ModelConfig {
    const defaults = this.getDefaultConfig();
    return {
      ...defaults,
      ...userConfig,  // User config overrides defaults
    };
  }

  // Sanitize and validate prompt
  protected sanitizePrompt(prompt: string): string {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt must be a non-empty string');
    }
    
    // Trim whitespace
    const sanitized = prompt.trim();
    
    if (sanitized.length === 0) {
      throw new Error('Prompt cannot be empty');
    }
    
    // Check maximum length (prevent excessively long prompts)
    const maxLength = 100000;  // 100k characters max
    if (sanitized.length > maxLength) {
      throw new Error(`Prompt is too long (max ${maxLength} characters)`);
    }
    
    return sanitized;
  }

  // Extract error information from API responses
  protected extractErrorInfo(error: any): { message: string, code?: string } {
    if (error instanceof Error) {
      return { message: error.message };
    }
    
    if (typeof error === 'string') {
      return { message: error };
    }
    
    if (error && typeof error === 'object') {
      // Try to extract common error fields
      const message = error.message || error.error || error.details || 'Unknown error';
      const code = error.code || error.status || error.statusCode;
      
      return { message: String(message), code: String(code) };
    }
    
    return { message: 'Unknown error occurred' };
  }

  // Log model usage for monitoring
  protected logUsage(prompt: string, response: string, tokens?: number): void {
    const usage = {
      provider: this.config.provider,
      model: this.config.model,
      promptLength: prompt.length,
      responseLength: response.length,
      tokens: tokens,
      timestamp: new Date().toISOString(),
    };
    
    // In production, you might want to send this to a monitoring service
    console.log('Model usage:', JSON.stringify(usage, null, 2));
  }

  // Calculate approximate token count (simple estimation)
  protected estimateTokens(text: string): number {
    // Simple token estimation (rough approximation)
    // In reality, you'd want to use a proper tokenizer
    const words = text.split(/\s+/).length;
    const chars = text.length;
    
    // Estimate: ~1 token per 4 characters or ~1.3 tokens per word
    const tokenByChars = Math.ceil(chars / 4);
    const tokenByWords = Math.ceil(words * 1.3);
    
    // Take the average of both estimates
    return Math.ceil((tokenByChars + tokenByWords) / 2);
  }

  // Apply token limits to response
  protected applyTokenLimit(response: string, maxTokens?: number): string {
    if (!maxTokens) {
      return response;  // No limit specified
    }
    
    // Estimate tokens in response
    const estimatedTokens = this.estimateTokens(response);
    
    if (estimatedTokens <= maxTokens) {
      return response;  // Within limit
    }
    
    // Truncate response to fit within token limit
    const ratio = maxTokens / estimatedTokens;
    const maxLength = Math.floor(response.length * ratio * 0.9);  // 90% to be safe
    
    return response.substring(0, maxLength) + '... [truncated]';
  }
}
