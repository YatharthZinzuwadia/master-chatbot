import { PromptTemplate } from '../types';  // Import PromptTemplate type

// State update prompt template for entity extraction
export const stateUpdatePrompt: PromptTemplate = {
  type: 'state',
  template: `Extract structured information from the following conversation.

Conversation Context:
{{conversationContext}}

User Message: {{userMessage}}

Instructions:
1. Analyze the user's message for entities, intents, and key information
2. Extract structured data that could be useful for future interactions
3. Focus on: names, dates, locations, preferences, tasks, emotions, etc.
4. Return the result as a valid JSON object
5. If no structured information can be extracted, return {"entities": {}}

Expected JSON format:
{
  "entities": {
    "person": ["names mentioned"],
    "location": ["places mentioned"],
    "date": ["dates/times mentioned"],
    "organization": ["companies/organizations mentioned"],
    "task": ["tasks or actions mentioned"],
    "preference": ["user preferences expressed"],
    "emotion": ["emotions or feelings expressed"],
    "topic": ["main topics discussed"]
  },
  "intent": "primary intent of the message",
  "confidence": 0.8,
  "context": {
    "summary": "brief summary of the message",
    "keywords": ["key", "words", "from", "message"]
  }
}

JSON Response:`,
  variables: ['conversationContext', 'userMessage']
};

// Simple entity extraction prompt
export const entityExtractionPrompt: PromptTemplate = {
  type: 'state',
  template: `Extract entities from this message: "{{userMessage}}"

Return a JSON object with the following structure:
{
  "entities": {
    "names": [],
    "places": [],
    "dates": [],
    "organizations": [],
    "tasks": [],
    "preferences": []
  },
  "intent": "",
  "keywords": []
}

JSON:`,
  variables: ['userMessage']
};

// Context analysis prompt for understanding conversation context
export const contextAnalysisPrompt: PromptTemplate = {
  type: 'state',
  template: `Analyze the conversation context and extract meaningful insights.

Recent Messages:
{{recentMessages}}

Current Message: {{currentMessage}}

Analysis Tasks:
1. Identify the main topic or theme
2. Detect any changes in topic or direction
3. Extract user preferences or patterns
4. Identify any follow-up actions needed
5. Assess conversation sentiment

Return JSON response:
{
  "topic": "main topic being discussed",
  "subtopics": ["related", "subtopics"],
  "sentiment": "positive/negative/neutral",
  "intent": "user's primary intent",
  "entities": {
    "mentioned": ["entities", "mentioned"],
    "new": ["new", "entities", "in", "this", "message"]
  },
  "context": {
    "continuation": true/false,
    "topic_change": true/false,
    "requires_followup": true/false,
    "summary": "brief context summary"
  }
}

JSON:`,
  variables: ['recentMessages', 'currentMessage']
};

// State update builder class
export class StateUpdateBuilder {
  // Build state update prompt based on the type of analysis needed
  static buildPrompt(
    userMessage: string,
    conversationContext?: string,
    recentMessages?: string[],
    analysisType: 'full' | 'entities' | 'context' = 'full'
  ): string {
    let template: PromptTemplate;
    let variables: Record<string, string>;

    switch (analysisType) {
      case 'entities':
        template = entityExtractionPrompt;
        variables = { userMessage };
        break;
      
      case 'context':
        template = contextAnalysisPrompt;
        variables = {
          currentMessage: userMessage,
          recentMessages: recentMessages?.join('\n') || 'No recent messages.'
        };
        break;
      
      case 'full':
      default:
        template = stateUpdatePrompt;
        variables = {
          conversationContext: conversationContext || 'No previous context.',
          userMessage
        };
        break;
    }

    // Replace variables in template
    return this.replaceVariables(template.template, variables);
  }

  // Replace template variables with actual values
  private static replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;

    // Replace each variable in the template
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }

    return result;
  }

  // Parse and validate the JSON response from the model
  static parseStateResponse(response: string): {
    success: boolean;
    data?: any;
    error?: string;
  } {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { success: false, error: 'No JSON found in response' };
      }

      const jsonData = JSON.parse(jsonMatch[0]);

      // Validate basic structure
      if (!jsonData || typeof jsonData !== 'object') {
        return { success: false, error: 'Invalid JSON structure' };
      }

      return { success: true, data: jsonData };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to parse JSON' 
      };
    }
  }

  // Extract entities from a message
  static async extractEntities(userMessage: string, modelAdapter: any): Promise<{
    entities: Record<string, string[]>;
    intent: string;
    keywords: string[];
  }> {
    try {
      // Build the entity extraction prompt
      const prompt = this.buildPrompt(userMessage, undefined, undefined, 'entities');
      
      // Get response from model
      const response = await modelAdapter.generateResponse(prompt, {
        provider: modelAdapter.getProvider(),
        model: 'unknown',
        temperature: 0.1,  // Low temperature for consistent extraction
        maxTokens: 500,   // Limit response size
      });

      // Parse the response
      const parsed = this.parseStateResponse(response);
      
      if (!parsed.success) {
        throw new Error(`Failed to parse entities: ${parsed.error}`);
      }

      // Return extracted data with defaults
      return {
        entities: parsed.data.entities || {},
        intent: parsed.data.intent || 'unknown',
        keywords: parsed.data.keywords || []
      };

    } catch (error) {
      // Return empty structure on error
      return {
        entities: {},
        intent: 'unknown',
        keywords: []
      };
    }
  }

  // Analyze conversation context
  static async analyzeContext(
    currentMessage: string,
    recentMessages: string[],
    modelAdapter: any
  ): Promise<{
    topic: string;
    sentiment: string;
    intent: string;
    context: any;
  }> {
    try {
      // Build the context analysis prompt
      const prompt = this.buildPrompt(currentMessage, undefined, recentMessages, 'context');
      
      // Get response from model
      const response = await modelAdapter.generateResponse(prompt, {
        provider: modelAdapter.getProvider(),
        model: 'unknown',
        temperature: 0.2,  // Low temperature for consistent analysis
        maxTokens: 800,    // Allow more detailed analysis
      });

      // Parse the response
      const parsed = this.parseStateResponse(response);
      
      if (!parsed.success) {
        throw new Error(`Failed to analyze context: ${parsed.error}`);
      }

      // Return analyzed data with defaults
      return {
        topic: parsed.data.topic || 'unknown',
        sentiment: parsed.data.sentiment || 'neutral',
        intent: parsed.data.intent || 'unknown',
        context: parsed.data.context || {}
      };

    } catch (error) {
      // Return empty structure on error
      return {
        topic: 'unknown',
        sentiment: 'neutral',
        intent: 'unknown',
        context: {}
      };
    }
  }

  // Full state update with entities and context
  static async fullStateUpdate(
    userMessage: string,
    conversationContext: string,
    modelAdapter: any
  ): Promise<{
    entities: Record<string, string[]>;
    intent: string;
    confidence: number;
    context: any;
  }> {
    try {
      // Build the full state update prompt
      const prompt = this.buildPrompt(userMessage, conversationContext, undefined, 'full');
      
      // Get response from model
      const response = await modelAdapter.generateResponse(prompt, {
        provider: modelAdapter.getProvider(),
        model: 'unknown',
        temperature: 0.3,  // Moderate temperature for balanced extraction
        maxTokens: 1000,   // Allow comprehensive analysis
      });

      // Parse the response
      const parsed = this.parseStateResponse(response);
      
      if (!parsed.success) {
        throw new Error(`Failed to perform full state update: ${parsed.error}`);
      }

      // Return comprehensive state data
      return {
        entities: parsed.data.entities || {},
        intent: parsed.data.intent || 'unknown',
        confidence: parsed.data.confidence || 0.5,
        context: parsed.data.context || {}
      };

    } catch (error) {
      // Return empty structure on error
      return {
        entities: {},
        intent: 'unknown',
        confidence: 0.0,
        context: {}
      };
    }
  }

  // Validate state update data
  static validateStateData(data: any): { valid: boolean, issues: string[] } {
    const issues: string[] = [];

    if (!data || typeof data !== 'object') {
      issues.push('State data must be an object');
      return { valid: false, issues };
    }

    // Check required fields
    if (!data.entities || typeof data.entities !== 'object') {
      issues.push('entities field is required and must be an object');
    }

    if (!data.intent || typeof data.intent !== 'string') {
      issues.push('intent field is required and must be a string');
    }

    // Check data types
    if (data.confidence !== undefined && (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1)) {
      issues.push('confidence must be a number between 0 and 1');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}
