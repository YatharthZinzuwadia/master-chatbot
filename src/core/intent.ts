import { Intent, ConversationMessage } from "../types"; // Import relevant types
import { toolManager } from "../tools"; // Import tool manager

// Intent detection class for analyzing user messages
export class IntentDetector {
  // Keywords and patterns for different intent types
  private readonly intentPatterns = {
    // Tool-related patterns
    tool: {
      keywords: [
        "read file",
        "write file",
        "create file",
        "delete file",
        "list files",
        "get user",
        "user data",
        "update preferences",
        "change settings",
        "session history",
        "conversation history",
        "show history",
      ],
      patterns: [
        /read.*file/gi,
        /write.*file/gi,
        /create.*file/gi,
        /delete.*file/gi,
        /list.*files?/gi,
        /get.*user/gi,
        /user.*data/gi,
        /update.*preferences/gi,
        /change.*settings/gi,
        /session.*history/gi,
        /conversation.*history/gi,
        /show.*history/gi,
      ],
    },

    // State update patterns
    state: {
      keywords: [
        "remember",
        "save",
        "preference",
        "setting",
        "profile",
        "store",
        "keep in mind",
        "note that",
        "update my",
      ],
      patterns: [
        /remember/gi,
        /save/gi,
        /preference/gi,
        /setting/gi,
        /profile/gi,
        /store/gi,
        /keep in mind/gi,
        /note that/gi,
        /update my/gi,
      ],
    },

    // Question patterns
    question: {
      keywords: [
        "what",
        "when",
        "where",
        "why",
        "how",
        "who",
        "which",
        "can you",
        "could you",
        "would you",
        "will you",
        "do you",
        "?",
        "explain",
        "tell me",
        "show me",
        "help me",
      ],
      patterns: [
        /^(what|when|where|why|how|who|which)/gi,
        /^(can you|could you|would you|will you|do you)/gi,
        /\?$/gi,
        /explain/gi,
        /tell me/gi,
        /show me/gi,
        /help me/gi,
      ],
    },

    // Command patterns
    command: {
      keywords: [
        "create",
        "make",
        "build",
        "generate",
        "write",
        "code",
        "implement",
        "develop",
        "design",
        "plan",
        "analyze",
      ],
      patterns: [
        /create/gi,
        /make/gi,
        /build/gi,
        /generate/gi,
        /write/gi,
        /code/gi,
        /implement/gi,
        /develop/gi,
        /design/gi,
        /plan/gi,
        /analyze/gi,
      ],
    },

    // Greeting patterns
    greeting: {
      keywords: [
        "hello",
        "hi",
        "hey",
        "good morning",
        "good afternoon",
        "good evening",
        "how are you",
        "what's up",
        "greetings",
      ],
      patterns: [
        /^(hello|hi|hey)/gi,
        /good (morning|afternoon|evening)/gi,
        /how are you/gi,
        /what'?s up/gi,
        /greetings/gi,
      ],
    },

    // Farewell patterns
    farewell: {
      keywords: [
        "bye",
        "goodbye",
        "see you",
        "see ya",
        "later",
        "farewell",
        "talk to you later",
        "catch you later",
      ],
      patterns: [
        /^(bye|goodbye)/gi,
        /see you/gi,
        /see ya/gi,
        /later/gi,
        /farewell/gi,
        /talk to you later/gi,
        /catch you later/gi,
      ],
    },
  };

  // Detect intent from user message and conversation context
  detectIntent(message: string, history: ConversationMessage[] = []): Intent {
    const cleanedMessage = message.toLowerCase().trim();

    // Check for tool intent first (most specific)
    const toolIntent = this.detectToolIntent(cleanedMessage);
    if (toolIntent.confidence > 0.7) {
      return toolIntent;
    }

    // Check for state update intent
    const stateIntent = this.detectStateIntent(cleanedMessage);
    if (stateIntent.confidence > 0.6) {
      return stateIntent;
    }

    // Check for other intents
    const intents = [
      this.detectQuestionIntent(cleanedMessage),
      this.detectCommandIntent(cleanedMessage),
      this.detectGreetingIntent(cleanedMessage),
      this.detectFarewellIntent(cleanedMessage),
    ];

    // Find the intent with highest confidence
    const bestIntent = intents.reduce((best, current) =>
      current.confidence > best.confidence ? current : best,
    );

    // If no strong intent detected, default to chat
    if (bestIntent.confidence < 0.5) {
      return {
        type: "chat",
        confidence: 0.8,
        parameters: { fallback: true },
      };
    }

    return bestIntent;
  }

  // Detect tool-related intent
  private detectToolIntent(message: string): Intent {
    const availableTools = toolManager.getToolNames();
    const toolPatterns = this.intentPatterns.tool;

    // Check for exact tool name matches
    for (const toolName of availableTools) {
      if (message.includes(toolName.toLowerCase())) {
        return {
          type: "tool",
          confidence: 0.9,
          parameters: { toolName },
          toolName,
        };
      }
    }

    // Check for keyword matches
    let keywordMatches = 0;
    for (const keyword of toolPatterns.keywords) {
      if (message.includes(keyword)) {
        keywordMatches++;
      }
    }

    // Check for pattern matches
    let patternMatches = 0;
    for (const pattern of toolPatterns.patterns) {
      if (pattern.test(message)) {
        patternMatches++;
      }
    }

    // Calculate confidence based on matches
    const totalMatches = keywordMatches + patternMatches;
    const confidence = Math.min(totalMatches * 0.3, 0.8);

    if (confidence > 0.5) {
      // Determine which tool based on keywords
      const toolName = this.mapKeywordsToTool(message);
      return {
        type: "tool",
        confidence,
        parameters: { detectedKeywords: keywordMatches + patternMatches },
        toolName,
      };
    }

    return {
      type: "chat",
      confidence: 0.1,
    };
  }

  // Detect state update intent
  private detectStateIntent(message: string): Intent {
    const statePatterns = this.intentPatterns.state;
    let matches = 0;

    // Check keywords
    for (const keyword of statePatterns.keywords) {
      if (message.includes(keyword)) {
        matches++;
      }
    }

    // Check patterns
    for (const pattern of statePatterns.patterns) {
      if (pattern.test(message)) {
        matches++;
      }
    }

    const confidence = Math.min(matches * 0.4, 0.8);

    if (confidence > 0.4) {
      return {
        type: "hybrid",
        confidence,
        parameters: {
          needsStateUpdate: true,
          stateKeywords: matches,
        },
      };
    }

    return {
      type: "chat",
      confidence: 0.1,
    };
  }

  // Detect question intent
  private detectQuestionIntent(message: string): Intent {
    const questionPatterns = this.intentPatterns.question;
    let matches = 0;

    // Check for question mark
    if (message.includes("?")) {
      matches += 2;
    }

    // Check keywords
    for (const keyword of questionPatterns.keywords) {
      if (message.includes(keyword)) {
        matches++;
      }
    }

    // Check patterns
    for (const pattern of questionPatterns.patterns) {
      if (pattern.test(message)) {
        matches++;
      }
    }

    const confidence = Math.min(matches * 0.3, 0.9);

    return {
      type: "chat",
      confidence,
      parameters: {
        isQuestion: true,
        questionType: this.categorizeQuestion(message),
      },
    };
  }

  // Detect command intent
  private detectCommandIntent(message: string): Intent {
    const commandPatterns = this.intentPatterns.command;
    let matches = 0;

    // Check keywords
    for (const keyword of commandPatterns.keywords) {
      if (message.includes(keyword)) {
        matches++;
      }
    }

    // Check patterns
    for (const pattern of commandPatterns.patterns) {
      if (pattern.test(message)) {
        matches++;
      }
    }

    const confidence = Math.min(matches * 0.35, 0.8);

    return {
      type: "chat",
      confidence,
      parameters: {
        isCommand: true,
        commandType: this.categorizeCommand(message),
      },
    };
  }

  // Detect greeting intent
  private detectGreetingIntent(message: string): Intent {
    const greetingPatterns = this.intentPatterns.greeting;
    let matches = 0;

    // Check keywords
    for (const keyword of greetingPatterns.keywords) {
      if (message.includes(keyword)) {
        matches++;
      }
    }

    // Check patterns
    for (const pattern of greetingPatterns.patterns) {
      if (pattern.test(message)) {
        matches++;
      }
    }

    const confidence = Math.min(matches * 0.4, 0.9);

    return {
      type: "chat",
      confidence,
      parameters: {
        isGreeting: true,
        greetingType: this.categorizeGreeting(message),
      },
    };
  }

  // Detect farewell intent
  private detectFarewellIntent(message: string): Intent {
    const farewellPatterns = this.intentPatterns.farewell;
    let matches = 0;

    // Check keywords
    for (const keyword of farewellPatterns.keywords) {
      if (message.includes(keyword)) {
        matches++;
      }
    }

    // Check patterns
    for (const pattern of farewellPatterns.patterns) {
      if (pattern.test(message)) {
        matches++;
      }
    }

    const confidence = Math.min(matches * 0.4, 0.9);

    return {
      type: "chat",
      confidence,
      parameters: {
        isFarewell: true,
        farewellType: this.categorizeFarewell(message),
      },
    };
  }

  // Map keywords to specific tool
  private mapKeywordsToTool(message: string): string {
    const toolMappings: Record<string, string> = {
      "read file": "readFile",
      "write file": "writeFile",
      "create file": "writeFile",
      "delete file": "deleteFile",
      "list files": "listFiles",
      "get user": "getUserData",
      "user data": "getUserData",
      "update preferences": "updateUserPreferences",
      "change settings": "updateUserPreferences",
      "session history": "getUserSessionHistory",
      "conversation history": "getUserSessionHistory",
      "show history": "getUserSessionHistory",
    };

    for (const [keyword, toolName] of Object.entries(toolMappings)) {
      if (message.includes(keyword)) {
        return toolName;
      }
    }

    return "unknown";
  }

  // Categorize question type
  private categorizeQuestion(message: string): string {
    if (message.startsWith("what")) return "what";
    if (message.startsWith("how")) return "how";
    if (message.startsWith("why")) return "why";
    if (message.startsWith("when")) return "when";
    if (message.startsWith("where")) return "where";
    if (message.startsWith("who")) return "who";
    if (message.startsWith("which")) return "which";
    if (message.includes("explain")) return "explanation";
    if (message.includes("help")) return "help";
    return "general";
  }

  // Categorize command type
  private categorizeCommand(message: string): string {
    if (message.includes("create") || message.includes("make"))
      return "creation";
    if (message.includes("write") || message.includes("code")) return "coding";
    if (message.includes("build") || message.includes("implement"))
      return "implementation";
    if (message.includes("design")) return "design";
    if (message.includes("plan")) return "planning";
    if (message.includes("analyze")) return "analysis";
    return "general";
  }

  // Categorize greeting type
  private categorizeGreeting(message: string): string {
    if (message.includes("hello")) return "hello";
    if (message.includes("hi")) return "hi";
    if (message.includes("hey")) return "hey";
    if (message.includes("good morning")) return "morning";
    if (message.includes("good afternoon")) return "afternoon";
    if (message.includes("good evening")) return "evening";
    return "general";
  }

  // Categorize farewell type
  private categorizeFarewell(message: string): string {
    if (message.includes("bye") || message.includes("goodbye"))
      return "goodbye";
    if (message.includes("see you")) return "see_you";
    if (message.includes("later")) return "later";
    return "general";
  }

  // Get intent detection statistics
  getStats(): {
    totalPatterns: number;
    toolCount: number;
    intentTypes: string[];
  } {
    const intentTypes = Object.keys(this.intentPatterns);
    const totalPatterns = intentTypes.reduce((total, type) => {
      const patterns =
        this.intentPatterns[type as keyof typeof this.intentPatterns];
      return total + patterns.keywords.length + patterns.patterns.length;
    }, 0);

    return {
      totalPatterns,
      toolCount: toolManager.getToolNames().length,
      intentTypes,
    };
  }

  // Add custom intent pattern
  addIntentPattern(
    intentType: string,
    keywords: string[],
    patterns: RegExp[],
  ): void {
    if (!this.intentPatterns[intentType as keyof typeof this.intentPatterns]) {
      this.intentPatterns[intentType as keyof typeof this.intentPatterns] = {
        keywords: [],
        patterns: [],
      };
    }

    const intentPattern =
      this.intentPatterns[intentType as keyof typeof this.intentPatterns];
    intentPattern.keywords.push(...keywords);
    intentPattern.patterns.push(...patterns);
  }
}

// Export singleton instance
export const intentDetector = new IntentDetector();
