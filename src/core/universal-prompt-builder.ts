import { SystemPrompt, KnowledgeEntry } from "../types"; // Import required types

// Universal prompt builder for dynamic AI execution layer
export class UniversalPromptBuilder {
  // Build the final prompt with the required structure:
  // SYSTEM PROMPT
  // RELEVANT KNOWLEDGE
  // TOOL CONTEXT (if exists)
  // USER INPUT
  buildFinalPrompt(
    systemPrompt: string,
    relevantKnowledge: KnowledgeEntry[],
    toolContext: string | null,
    userInput: string,
  ): string {
    // Build prompt sections according to required structure
    let prompt = "";

    // 1. SYSTEM PROMPT
    prompt += `${systemPrompt}\n\n`;

    // 2. RELEVANT KNOWLEDGE
    prompt += "Knowledge:\n";
    if (relevantKnowledge.length > 0) {
      relevantKnowledge.forEach((entry, index) => {
        prompt += `${index + 1}. [${entry.category.toUpperCase()}] ${entry.content}\n`;
      });
    } else {
      prompt += "No relevant knowledge available.\n";
    }
    prompt += "\n";

    // 3. TOOL CONTEXT (if exists)
    if (toolContext) {
      prompt += `Context:\n${toolContext}\n\n`;
    }

    // 4. USER INPUT
    prompt += `User:\n${userInput}\n\n`;

    // 5. Answer instruction
    prompt += "Answer clearly:";

    return prompt;
  }

  // Build tool context string from tool results
  buildToolContext(toolResults: any[]): string {
    if (toolResults.length === 0) {
      return "";
    }

    let context = "Tool Results:\n";
    toolResults.forEach((result, index) => {
      if (result.success) {
        context += `${index + 1}. ${result.toolName}: ${JSON.stringify(result.result, null, 2)}\n`;
      } else {
        context += `${index + 1}. ${result.toolName}: ERROR - ${result.error}\n`;
      }
    });

    return context;
  }

  // Extract context information for tools
  extractToolContext(requestContext: any): string {
    if (!requestContext) {
      return "";
    }

    let contextParts: string[] = [];

    // Add files context
    if (requestContext.files && requestContext.files.length > 0) {
      contextParts.push(`Files: ${requestContext.files.join(", ")}`);
    }

    // Add repositories context
    if (requestContext.repos && requestContext.repos.length > 0) {
      contextParts.push(`Repositories: ${requestContext.repos.join(", ")}`);
    }

    // Add URLs context
    if (requestContext.urls && requestContext.urls.length > 0) {
      contextParts.push(`URLs: ${requestContext.urls.join(", ")}`);
    }

    // Add metadata context
    if (
      requestContext.metadata &&
      Object.keys(requestContext.metadata).length > 0
    ) {
      contextParts.push(
        `Metadata: ${JSON.stringify(requestContext.metadata, null, 2)}`,
      );
    }

    return contextParts.join("\n");
  }

  // Format system prompt from SystemPrompt object
  formatSystemPrompt(systemPromptObj: SystemPrompt): string {
    let prompt = systemPromptObj.content;

    // Add rules if available
    if (systemPromptObj.rules && systemPromptObj.rules.length > 0) {
      prompt += "\n\nRules:\n";
      systemPromptObj.rules.forEach((rule: string, index: number) => {
        prompt += `${index + 1}. ${rule}\n`;
      });
    }

    // Add behavior guidelines if available
    if (systemPromptObj.behavior && systemPromptObj.behavior.length > 0) {
      prompt += "\n\nBehavior Guidelines:\n";
      systemPromptObj.behavior.forEach((behavior: string, index: number) => {
        prompt += `${index + 1}. ${behavior}\n`;
      });
    }

    return prompt;
  }

  // Build context-aware prompt that considers conversation history
  buildContextAwarePrompt(
    systemPrompt: string,
    relevantKnowledge: KnowledgeEntry[],
    toolContext: string | null,
    userInput: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
  ): string {
    let prompt = systemPrompt + "\n\n";

    // Add conversation context if available
    if (conversationHistory.length > 0) {
      prompt += "Conversation History:\n";
      const recentHistory = conversationHistory.slice(-5); // Last 5 messages
      recentHistory.forEach((msg) => {
        prompt += `${msg.role}: ${msg.content}\n`;
      });
      prompt += "\n";
    }

    // Add knowledge
    prompt += "Knowledge:\n";
    if (relevantKnowledge.length > 0) {
      relevantKnowledge.forEach((entry, index) => {
        prompt += `${index + 1}. [${entry.category.toUpperCase()}] ${entry.content}\n`;
      });
    } else {
      prompt += "No relevant knowledge available.\n";
    }
    prompt += "\n";

    // Add tool context
    if (toolContext) {
      prompt += `Context:\n${toolContext}\n\n`;
    }

    // Add user input
    prompt += `User:\n${userInput}\n\n`;

    // Add answer instruction
    prompt += "Answer clearly:";

    return prompt;
  }

  // Validate prompt structure
  validatePromptStructure(prompt: string): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check for required sections
    if (!prompt.includes("Knowledge:")) {
      issues.push("Missing Knowledge section");
    }

    if (!prompt.includes("User:")) {
      issues.push("Missing User section");
    }

    if (!prompt.includes("Answer clearly")) {
      issues.push("Missing answer instruction");
    }

    // Check for reasonable length
    if (prompt.length > 50000) {
      issues.push("Prompt too long (may exceed token limits)");
    }

    if (prompt.length < 50) {
      issues.push("Prompt too short (may lack context)");
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  // Get prompt statistics
  getPromptStats(prompt: string): {
    length: number;
    estimatedTokens: number;
    sections: string[];
  } {
    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    const estimatedTokens = Math.ceil(prompt.length / 4);

    // Extract sections
    const sectionRegex =
      /^(Knowledge|User|Context|Rules|Behavior Guidelines|Conversation History):/gm;
    const sections: string[] = [];
    let match;

    while ((match = sectionRegex.exec(prompt)) !== null) {
      if (match[1]) {
        sections.push(match[1]);
      }
    }

    return {
      length: prompt.length,
      estimatedTokens,
      sections,
    };
  }
}

// Export singleton instance
export const universalPromptBuilder = new UniversalPromptBuilder();
