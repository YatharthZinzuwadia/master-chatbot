import { SimpleIntent, IntentDetectionResult } from "../types"; // Import required types

// Fallback handler for error scenarios - system MUST NOT break
export class FallbackHandler {
  
  // Handle cases where no tools match, tool fails, or no relevant knowledge
  async handleFallback(
    originalInput: string,
    intentResult: IntentDetectionResult,
    toolError?: Error,
    knowledgeAvailable: boolean = false
  ): Promise<{
    shouldFallback: boolean;
    fallbackResponse: string;
    fallbackReason: string;
  }> {
    
    // CASE 1: Tool execution failed
    if (toolError) {
      return {
        shouldFallback: true,
        fallbackResponse: this.buildToolErrorFallback(originalInput, toolError),
        fallbackReason: `Tool execution failed: ${toolError.message}`
      };
    }
    
    // CASE 2: No tools available for intent
    if (intentResult.intent.type === "tool" && !this.hasMatchingTool(intentResult.intent.toolName)) {
      return {
        shouldFallback: true,
        fallbackResponse: this.buildNoToolFallback(originalInput, intentResult.intent.toolName),
        fallbackReason: `No matching tool found: ${intentResult.intent.toolName}`
      };
    }
    
    // CASE 3: No relevant knowledge available
    if (!knowledgeAvailable && this.mightNeedKnowledge(originalInput)) {
      return {
        shouldFallback: true,
        fallbackResponse: this.buildNoKnowledgeFallback(originalInput),
        fallbackReason: "No relevant knowledge available for this query"
      };
    }
    
    // CASE 4: Intent confidence too low
    if (intentResult.confidence < 0.5) {
      return {
        shouldFallback: true,
        fallbackResponse: this.buildLowConfidenceFallback(originalInput),
        fallbackReason: `Low intent confidence: ${intentResult.confidence}`
      };
    }
    
    // CASE 5: No fallback needed - proceed normally
    return {
      shouldFallback: false,
      fallbackResponse: "",
      fallbackReason: "No fallback needed"
    };
  }
  
  // Build fallback response for tool errors
  private buildToolErrorFallback(originalInput: string, error: Error): string {
    return `I encountered an error while trying to process your request. Let me help you differently.

Your request: "${originalInput}"

Instead, I can:
1. Provide general guidance on this topic
2. Suggest alternative approaches
3. Help you rephrase the request

What would you prefer?`;
  }
  
  // Build fallback response when no matching tool is found
  private buildNoToolFallback(originalInput: string, toolName: string): string {
    return `I don't have access to the "${toolName}" tool that would be best for your request.

Your request: "${originalInput}"

However, I can still help you by:
1. Providing general information about this topic
2. Suggesting manual approaches
3. Helping you find alternative solutions

How would you like me to assist?`;
  }
  
  // Build fallback response when no relevant knowledge is available
  private buildNoKnowledgeFallback(originalInput: string): string {
    return `I don't have specific knowledge about your query, but I'll do my best to help.

Your request: "${originalInput}"

Based on general knowledge, I can provide:
1. Basic information on related topics
2. General guidance and best practices
3. Suggestions for where to find more information

What aspect would be most helpful?`;
  }
  
  // Build fallback response for low confidence intents
  private buildLowConfidenceFallback(originalInput: string): string {
    return `I'm not entirely sure what you're looking for with this request.

Your request: "${originalInput}"

Could you clarify:
1. What specific task are you trying to accomplish?
2. Are you looking for information, analysis, or action?
3. What context should I consider?

This will help me provide a more helpful response.`;
  }
  
  // Check if we have a matching tool available
  private hasMatchingTool(toolName: string): boolean {
    // This would integrate with the dynamic tool manager
    // For now, return false to demonstrate fallback
    return false;
  }
  
  // Determine if input might need knowledge base
  private mightNeedKnowledge(input: string): boolean {
    const knowledgeIndicators = [
      "what is", "explain", "how does", "tell me about",
      "information", "details", "background", "context"
    ];
    
    const lowerInput = input.toLowerCase();
    return knowledgeIndicators.some(indicator => lowerInput.includes(indicator));
  }
  
  // Handle multiple fallback scenarios
  async handleMultipleFallbacks(
    scenarios: Array<{
      type: 'tool_error' | 'no_tool' | 'no_knowledge' | 'low_confidence';
      details: any;
    }>
  ): Promise<{
    response: string;
    appliedFallbacks: string[];
  }> {
    
    const appliedFallbacks: string[] = [];
    let response = "";
    
    // Handle each scenario in order of priority
    for (const scenario of scenarios) {
      switch (scenario.type) {
        case 'tool_error':
          response += this.buildToolErrorFallback(scenario.details.input, scenario.details.error) + "\n\n";
          appliedFallbacks.push('tool_error');
          break;
          
        case 'no_tool':
          response += this.buildNoToolFallback(scenario.details.input, scenario.details.toolName) + "\n\n";
          appliedFallbacks.push('no_tool');
          break;
          
        case 'no_knowledge':
          response += this.buildNoKnowledgeFallback(scenario.details.input) + "\n\n";
          appliedFallbacks.push('no_knowledge');
          break;
          
        case 'low_confidence':
          response += this.buildLowConfidenceFallback(scenario.details.input) + "\n\n";
          appliedFallbacks.push('low_confidence');
          break;
      }
    }
    
    // Add general help message if multiple fallbacks
    if (appliedFallbacks.length > 1) {
      response += "\nI'm experiencing some limitations, but I'm still here to help. Please let me know how I can assist you best.";
    }
    
    return {
      response: response.trim(),
      appliedFallbacks
    };
  }
  
  // Create safe response that never fails
  createSafeResponse(input: string): string {
    // Always return a valid response, no matter what
    return `I understand you're asking about: "${input}"

I'm here to help and will do my best to assist you. Could you tell me more about what you'd like to know or accomplish?`;
  }
  
  // Log fallback events for monitoring
  logFallbackEvent(
    type: string, 
    input: string, 
    reason: string, 
    context?: any
  ): void {
    console.log(`Fallback triggered:`, {
      type,
      input: input.substring(0, 100) + "...", // Truncate for logging
      reason,
      context,
      timestamp: new Date().toISOString()
    });
  }
}

// Export singleton instance
export const fallbackHandler = new FallbackHandler();
