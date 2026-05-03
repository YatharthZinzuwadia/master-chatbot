import { Conversation, ConversationMessage } from "../types"; // Import relevant types

// Context builder class for creating conversation context
export class ContextBuilder {
  // Build comprehensive context from conversation and messages
  buildContext(
    conversation: Conversation,
    messages: ConversationMessage[],
    additionalContext?: Record<string, any>,
  ): Record<string, any> {
    const context: Record<string, any> = {
      // Conversation information
      conversation: {
        id: conversation.id,
        messageCount: conversation.messages.length,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        duration: this.calculateSessionDuration(conversation),
        metadata: conversation.metadata || {},
      },

      // Message analysis
      messages: {
        total: messages.length,
        userMessages: messages.filter((m) => m.role === "user").length,
        assistantMessages: messages.filter((m) => m.role === "assistant")
          .length,
        systemMessages: messages.filter((m) => m.role === "system").length,
        averageMessageLength: this.calculateAverageMessageLength(messages),
        topics: this.extractTopics(messages),
        sentiment: this.analyzeSentiment(messages),
      },

      // Conversation flow
      flow: {
        lastMessage: this.getLastMessage(messages),
        recentActivity: this.getRecentActivity(messages),
        conversationState: this.determineConversationState(messages),
        userEngagement: this.calculateUserEngagement(messages),
      },

      // Additional context
      additional: additionalContext || {},
    };

    return context;
  }

  // Build context for prompt generation
  buildPromptContext(
    messages: ConversationMessage[],
    userMessage: string,
    options?: {
      includeHistory?: boolean;
      maxHistoryLength?: number;
      includeMetadata?: boolean;
    },
  ): {
    systemPrompt: string;
    conversationHistory: string;
    currentContext: string;
    metadata: Record<string, any>;
  } {
    const {
      includeHistory = true,
      maxHistoryLength = 10,
      includeMetadata = true,
    } = options || {};

    // Build conversation history
    const conversationHistory = includeHistory
      ? this.formatConversationHistory(messages.slice(-maxHistoryLength))
      : "No previous conversation.";

    // Build current context
    const currentContext = this.buildCurrentContext(messages, userMessage);

    // Build system prompt context
    const systemPrompt = this.buildSystemPromptContext(messages, userMessage);

    // Build metadata
    const metadata = includeMetadata
      ? this.buildMessageMetadata(messages, userMessage)
      : {};

    return {
      systemPrompt,
      conversationHistory,
      currentContext,
      metadata,
    };
  }

  // Calculate session duration
  private calculateSessionDuration(conversation: Conversation): string {
    const duration = Date.now() - conversation.createdAt.getTime();
    const minutes = Math.floor(duration / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m`;
    }
  }

  // Calculate average message length
  private calculateAverageMessageLength(
    messages: ConversationMessage[],
  ): number {
    if (messages.length === 0) return 0;

    const totalLength = messages.reduce(
      (sum, message) => sum + message.content.length,
      0,
    );
    return Math.round(totalLength / messages.length);
  }

  // Extract topics from messages
  private extractTopics(messages: ConversationMessage[]): string[] {
    // Simple topic extraction based on keywords
    const allText = messages.map((m) => m.content.toLowerCase()).join(" ");

    const topicKeywords: Record<string, string[]> = {
      technology: [
        "ai",
        "machine learning",
        "programming",
        "code",
        "software",
        "computer",
      ],
      business: ["business", "market", "sales", "revenue", "profit", "company"],
      education: ["learn", "study", "teach", "education", "school", "course"],
      health: [
        "health",
        "medical",
        "doctor",
        "medicine",
        "fitness",
        "exercise",
      ],
      entertainment: ["movie", "music", "game", "book", "fun", "entertainment"],
    };

    const detectedTopics: string[] = [];

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      const matches = keywords.filter((keyword) =>
        allText.includes(keyword),
      ).length;
      if (matches >= 2) {
        // Need at least 2 keyword matches
        detectedTopics.push(topic);
      }
    }

    return detectedTopics.length > 0 ? detectedTopics : ["general"];
  }

  // Analyze sentiment from messages
  private analyzeSentiment(messages: ConversationMessage[]): {
    overall: "positive" | "negative" | "neutral";
    confidence: number;
  } {
    if (messages.length === 0) {
      return { overall: "neutral", confidence: 0 };
    }

    // Simple sentiment analysis based on keywords
    const positiveWords = [
      "good",
      "great",
      "excellent",
      "amazing",
      "wonderful",
      "love",
      "like",
      "happy",
      "thank",
    ];
    const negativeWords = [
      "bad",
      "terrible",
      "awful",
      "hate",
      "dislike",
      "sad",
      "angry",
      "frustrated",
      "problem",
    ];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const message of messages) {
      const text = message.content.toLowerCase();

      positiveWords.forEach((word) => {
        if (text.includes(word)) positiveCount++;
      });

      negativeWords.forEach((word) => {
        if (text.includes(word)) negativeCount++;
      });
    }

    const totalSentimentWords = positiveCount + negativeCount;

    if (totalSentimentWords === 0) {
      return { overall: "neutral", confidence: 0.5 };
    }

    const positiveRatio = positiveCount / totalSentimentWords;
    const confidence = Math.min(totalSentimentWords / messages.length, 1);

    if (positiveRatio > 0.6) {
      return { overall: "positive", confidence };
    } else if (positiveRatio < 0.4) {
      return { overall: "negative", confidence };
    } else {
      return { overall: "neutral", confidence };
    }
  }

  // Get last message
  private getLastMessage(
    messages: ConversationMessage[],
  ): ConversationMessage | null {
    return messages.length > 0 ? (messages[messages.length - 1] ?? null) : null;
  }

  // Get recent activity summary
  private getRecentActivity(messages: ConversationMessage[]): string {
    if (messages.length === 0) return "No activity";

    const recentMessages = messages.slice(-3);
    const activities = recentMessages.map(
      (m) => `${m.role}: ${m.content.substring(0, 50)}...`,
    );

    return activities.join(" | ");
  }

  // Determine conversation state
  private determineConversationState(messages: ConversationMessage[]): string {
    if (messages.length === 0) return "new";

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return "new";

    const timeSinceLastMessage = Date.now() - lastMessage.timestamp.getTime();
    const hoursSinceLastMessage = timeSinceLastMessage / (1000 * 60 * 60);

    if (hoursSinceLastMessage > 24) {
      return "stale";
    } else if (hoursSinceLastMessage > 1) {
      return "paused";
    } else if (messages.length < 3) {
      return "starting";
    } else {
      return "active";
    }
  }

  // Calculate user engagement
  private calculateUserEngagement(messages: ConversationMessage[]): {
    level: "high" | "medium" | "low";
    score: number;
  } {
    if (messages.length === 0) {
      return { level: "low", score: 0 };
    }

    const userMessages = messages.filter((m) => m.role === "user");
    const averageUserMessageLength =
      userMessages.reduce((sum, m) => sum + m.content.length, 0) /
      userMessages.length;

    // Calculate engagement score based on multiple factors
    let score = 0;

    // Factor 1: Message count (more messages = higher engagement)
    score += Math.min(messages.length / 10, 0.3) * 100;

    // Factor 2: Average message length (longer messages = higher engagement)
    score += Math.min(averageUserMessageLength / 200, 0.3) * 100;

    // Factor 3: Conversation continuity (recent messages = higher engagement)
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return { level: "low", score: 0 };

    const timeSinceLastMessage = Date.now() - lastMessage.timestamp.getTime();
    const hoursSinceLastMessage = timeSinceLastMessage / (1000 * 60 * 60);

    if (hoursSinceLastMessage < 1) {
      score += 40; // Very recent activity
    } else if (hoursSinceLastMessage < 24) {
      score += 20; // Recent activity
    }

    score = Math.min(score, 100);

    let level: "high" | "medium" | "low";
    if (score >= 70) {
      level = "high";
    } else if (score >= 40) {
      level = "medium";
    } else {
      level = "low";
    }

    return { level, score: Math.round(score) };
  }

  // Format conversation history for prompts
  private formatConversationHistory(messages: ConversationMessage[]): string {
    if (messages.length === 0) {
      return "No previous conversation.";
    }

    return messages
      .map((message) => {
        const timestamp = message.timestamp.toLocaleTimeString();
        return `[${timestamp}] ${message.role.charAt(0).toUpperCase() + message.role.slice(1)}: ${message.content}`;
      })
      .join("\n");
  }

  // Build current context
  private buildCurrentContext(
    messages: ConversationMessage[],
    userMessage: string,
  ): string {
    const context: string[] = [];

    // Add conversation state
    const state = this.determineConversationState(messages);
    context.push(`Conversation state: ${state}`);

    // Add recent activity
    const activity = this.getRecentActivity(messages);
    if (activity !== "No activity") {
      context.push(`Recent activity: ${activity}`);
    }

    // Add topic information
    const topics = this.extractTopics(messages);
    if (topics.length > 0 && topics[0] !== "general") {
      context.push(`Topics discussed: ${topics.join(", ")}`);
    }

    // Add user engagement
    const engagement = this.calculateUserEngagement(messages);
    context.push(
      `User engagement: ${engagement.level} (${engagement.score}/100)`,
    );

    return context.join("\n");
  }

  // Build system prompt context
  private buildSystemPromptContext(
    messages: ConversationMessage[],
    userMessage: string,
  ): string {
    const context: string[] = [];

    // Add message count
    context.push(
      `This is message #${messages.length + 1} in the conversation.`,
    );

    // Add conversation length context
    if (messages.length === 0) {
      context.push("This is the beginning of a new conversation.");
    } else if (messages.length < 5) {
      context.push("This is a short conversation.");
    } else {
      context.push("This is an ongoing conversation.");
    }

    // Add user message context
    if (userMessage.includes("?")) {
      context.push("The user is asking a question.");
    } else if (userMessage.length < 20) {
      context.push("The user sent a short message.");
    } else {
      context.push("The user sent a detailed message.");
    }

    return context.join("\n");
  }

  // Build message metadata
  private buildMessageMetadata(
    messages: ConversationMessage[],
    userMessage: string,
  ): Record<string, any> {
    return {
      messageCount: messages.length,
      currentMessageLength: userMessage.length,
      estimatedTokens: this.estimateTokens(userMessage),
      timestamp: new Date().toISOString(),
      hasHistory: messages.length > 0,
      lastMessageTime:
        messages.length > 0
          ? (messages[messages.length - 1]?.timestamp?.toISOString() ?? null)
          : null,
    };
  }

  // Estimate token count (simple approximation)
  private estimateTokens(text: string): number {
    const words = text.split(/\s+/).length;
    const chars = text.length;

    const tokenByChars = Math.ceil(chars / 4);
    const tokenByWords = Math.ceil(words * 1.3);

    return Math.ceil((tokenByChars + tokenByWords) / 2);
  }

  // Build context for state updates
  buildStateUpdateContext(
    messages: ConversationMessage[],
    userMessage: string,
  ): {
    conversationSummary: string;
    userIntent: string;
    entities: Record<string, string[]>;
    context: Record<string, any>;
  } {
    const conversationSummary = this.buildConversationSummary(messages);
    const userIntent = this.detectUserIntent(userMessage);
    const entities = this.extractEntities(userMessage, messages);
    const context = this.buildContext({} as Conversation, messages);

    return {
      conversationSummary,
      userIntent,
      entities,
      context,
    };
  }

  // Build conversation summary
  private buildConversationSummary(messages: ConversationMessage[]): string {
    if (messages.length === 0) {
      return "No previous conversation.";
    }

    const topics = this.extractTopics(messages);
    const sentiment = this.analyzeSentiment(messages);
    const state = this.determineConversationState(messages);

    return `Conversation about ${topics.join(", ")}. Overall sentiment is ${sentiment.overall} with ${sentiment.confidence} confidence. Conversation state: ${state}.`;
  }

  // Detect user intent
  private detectUserIntent(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("?")) return "question";
    if (lowerMessage.includes("help")) return "help_request";
    if (lowerMessage.includes("create") || lowerMessage.includes("make"))
      return "creation";
    if (lowerMessage.includes("explain") || lowerMessage.includes("tell me"))
      return "information";
    if (lowerMessage.includes("remember") || lowerMessage.includes("save"))
      return "memory";

    return "general";
  }

  // Extract entities from message and history
  private extractEntities(
    message: string,
    messages: ConversationMessage[],
  ): Record<string, string[]> {
    const allText = (
      message +
      " " +
      messages.map((m) => m.content).join(" ")
    ).toLowerCase();

    const entities: Record<string, string[]> = {
      names: [],
      places: [],
      dates: [],
      organizations: [],
      tasks: [],
    };

    // Simple entity extraction (would be enhanced with NLP in production)
    const datePattern =
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g;
    const dates = allText.match(datePattern) || [];
    entities.dates = [...new Set(dates)];

    // Extract capitalized words (potential names/organizations)
    const capitalizedWords = allText.match(/\b[A-Z][a-z]+\b/g) || [];
    entities.names = [...new Set(capitalizedWords)];

    return entities;
  }
}

// Export singleton instance
export const contextBuilder = new ContextBuilder();
