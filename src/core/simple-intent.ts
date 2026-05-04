import { SimpleIntent, IntentDetectionResult, ToolDefinition } from "../types"; // Import required types

// Simple intent detector - NO ML models, only keyword + context checks
export class SimpleIntentDetector {
  
  // Detect intent from user input and available tools
  detectIntent(
    userInput: string, 
    tools: ToolDefinition[], 
    context?: any
  ): IntentDetectionResult {
    
    const lowerInput = userInput.toLowerCase().trim();
    
    // RULE 1: General questions → chat
    if (this.isGeneralQuestion(lowerInput)) {
      return {
        intent: { type: "chat" },
        confidence: 0.9,
        reasoning: "General question detected - responding normally"
      };
    }
    
    // RULE 2: References to files/repos/data → tool
    const toolIntent = this.detectToolIntent(lowerInput, tools, context);
    if (toolIntent) {
      return toolIntent;
    }
    
    // RULE 3: Check for action keywords that might need tools
    const actionIntent = this.detectActionIntent(lowerInput, tools);
    if (actionIntent) {
      return actionIntent;
    }
    
    // DEFAULT: Fallback to chat
    return {
      intent: { type: "chat" },
      confidence: 0.7,
      reasoning: "No specific tool intent detected - defaulting to chat"
    };
  }
  
  // Check if input is a general question
  private isGeneralQuestion(input: string): boolean {
    const questionWords = [
      "what", "when", "where", "why", "how", "who", "which",
      "can you", "could you", "would you", "will you", "do you",
      "explain", "tell me", "show me", "help me"
    ];
    
    const hasQuestionMark = input.includes("?");
    const hasQuestionWord = questionWords.some(word => input.includes(word));
    
    return hasQuestionMark || hasQuestionWord;
  }
  
  // Detect tool-related intent
  private detectToolIntent(
    input: string, 
    tools: ToolDefinition[], 
    context?: any
  ): IntentDetectionResult | null {
    
    // Check for file/repo/data references in input
    const fileKeywords = ["file", "read", "write", "create", "delete", "open", "save"];
    const repoKeywords = ["repo", "repository", "git", "clone", "push", "pull"];
    const dataKeywords = ["data", "database", "fetch", "get", "retrieve", "query"];
    
    const hasFileRef = fileKeywords.some(keyword => input.includes(keyword));
    const hasRepoRef = repoKeywords.some(keyword => input.includes(keyword));
    const hasDataRef = dataKeywords.some(keyword => input.includes(keyword));
    
    // Check context for files/repos/urls
    const hasFilesInContext = context?.files && context.files.length > 0;
    const hasReposInContext = context?.repos && context.repos.length > 0;
    const hasUrlsInContext = context?.urls && context.urls.length > 0;
    
    // If any file/repo/data references found, look for matching tool
    if (hasFileRef || hasRepoRef || hasDataRef || hasFilesInContext || hasReposInContext || hasUrlsInContext) {
      
      // Find best matching tool based on keywords
      const matchedTool = this.findBestMatchingTool(input, tools);
      
      if (matchedTool) {
        return {
          intent: { 
            type: "tool", 
            toolName: matchedTool.name, 
            reason: this.generateReason(input, matchedTool) 
          },
          confidence: 0.8,
          reasoning: `Tool intent detected: ${matchedTool.name} - references to files/repos/data found`
        };
      }
    }
    
    return null;
  }
  
  // Detect action-based intent
  private detectActionIntent(input: string, tools: ToolDefinition[]): IntentDetectionResult | null {
    
    // Action keywords that typically need tools
    const actionKeywords = [
      "execute", "run", "process", "analyze", "search", "find",
      "calculate", "compute", "transform", "convert", "validate"
    ];
    
    const hasActionKeyword = actionKeywords.some(keyword => input.includes(keyword));
    
    if (hasActionKeyword) {
      const matchedTool = this.findBestMatchingTool(input, tools);
      
      if (matchedTool) {
        return {
          intent: { 
            type: "tool", 
            toolName: matchedTool.name, 
            reason: `Action keyword detected: ${matchedTool.name}` 
          },
          confidence: 0.7,
          reasoning: `Action intent detected: ${matchedTool.name}`
        };
      }
    }
    
    return null;
  }
  
  // Find best matching tool based on input and tool descriptions
  private findBestMatchingTool(input: string, tools: ToolDefinition[]): ToolDefinition | null {
    
    if (tools.length === 0) return null;
    
    // Score each tool based on keyword matches
    const toolScores = tools.map(tool => {
      let score = 0;
      
      // Check tool name match
      if (input.includes(tool.name.toLowerCase())) {
        score += 3; // High score for exact name match
      }
      
      // Check description keywords
      const descriptionWords = tool.description.toLowerCase().split(/\s+/);
      const inputWords = input.split(/\s+/);
      
      descriptionWords.forEach(descWord => {
        if (inputWords.some(inputWord => inputWord === descWord)) {
          score += 1; // Medium score for description match
        }
      });
      
      // Check partial matches
      descriptionWords.forEach(descWord => {
        if (input.includes(descWord) && descWord.length > 3) {
          score += 0.5; // Low score for partial match
        }
      });
      
      return { tool, score };
    });
    
    // Return tool with highest score
    const bestMatch = toolScores.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    return bestMatch.score > 0 ? bestMatch.tool : null;
  }
  
  // Generate reason for tool selection
  private generateReason(input: string, tool: ToolDefinition): string {
    const lowerInput = input.toLowerCase();
    
    // Check for specific patterns
    if (lowerInput.includes("file") && tool.name.toLowerCase().includes("file")) {
      return "File operation requested";
    }
    
    if (lowerInput.includes("read") && tool.name.toLowerCase().includes("read")) {
      return "Read operation requested";
    }
    
    if (lowerInput.includes("write") && tool.name.toLowerCase().includes("write")) {
      return "Write operation requested";
    }
    
    if (lowerInput.includes("data") && tool.name.toLowerCase().includes("data")) {
      return "Data operation requested";
    }
    
    // Generic reason based on tool description
    return `Tool "${tool.name}" matches request: ${tool.description}`;
  }
}

// Export singleton instance
export const simpleIntentDetector = new SimpleIntentDetector();
