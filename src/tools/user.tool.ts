import { Tool } from "../types"; // Import Tool type

// Helper function to find user by ID (replace with actual database query)
async function findUserById(userId: string): Promise<any> {
  // This is a mock implementation
  // In a real application, you would query your user database
  const mockUsers: Record<string, any> = {
    user123: {
      id: "user123",
      name: "John Doe",
      email: "john.doe@example.com",
      preferences: {
        theme: "dark",
        language: "en",
        notifications: true,
        timezone: "UTC",
      },
      sessionHistory: [
        {
          sessionId: "session456",
          lastActive: new Date("2024-01-15T10:30:00Z"),
          messageCount: 25,
        },
        {
          sessionId: "session789",
          lastActive: new Date("2024-01-14T15:45:00Z"),
          messageCount: 12,
        },
      ],
    },
    user456: {
      id: "user456",
      name: "Jane Smith",
      email: "jane.smith@example.com",
      preferences: {
        theme: "light",
        language: "es",
        notifications: false,
        timezone: "EST",
      },
      sessionHistory: [
        {
          sessionId: "session321",
          lastActive: new Date("2024-01-15T09:15:00Z"),
          messageCount: 8,
        },
      ],
    },
  };

  return mockUsers[userId] || null;
}

// Helper function to find user by session (replace with actual database query)
async function findUserBySession(sessionId: string): Promise<any> {
  // This is a mock implementation
  // In a real application, you would query your session database to find the associated user
  const mockSessionToUser: Record<string, string> = {
    session456: "user123",
    session789: "user123",
    session321: "user456",
  };

  const userId = mockSessionToUser[sessionId];
  if (userId) {
    return await findUserById(userId);
  }

  return null;
}

// User data retrieval tool implementation
export const getUserDataTool: Tool = {
  name: "getUserData",
  description: "Retrieve user information and preferences from the database",

  // Execute function for getting user data
  async execute(input: { userId?: string; sessionId?: string }): Promise<{
    success: boolean;
    userData?: {
      id: string;
      name?: string;
      email?: string;
      preferences?: Record<string, any>;
      sessionHistory?: Array<{
        sessionId: string;
        lastActive: Date;
        messageCount: number;
      }>;
    };
    error?: string;
  }> {
    try {
      // Validate input parameters
      if (!input || (!input.userId && !input.sessionId)) {
        return {
          success: false,
          error: "Either userId or sessionId parameter is required",
        };
      }

      const { userId, sessionId } = input;

      // Mock user data for demonstration (in real implementation, this would query a database)
      let userData: any;

      if (userId) {
        // Mock user lookup by ID
        userData = await findUserById(userId);
      } else if (sessionId) {
        // Mock user lookup by session
        userData = await findUserBySession(sessionId);
      }

      if (!userData) {
        return {
          success: false,
          error: "User not found",
        };
      }

      return {
        success: true,
        userData,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error occurred while retrieving user data",
      };
    }
  },
};

// Helper function to validate preferences structure
function validatePreferences(preferences: Record<string, any>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Define allowed preference keys and their types
  const allowedPreferences: Record<string, string> = {
    theme: "string",
    language: "string",
    notifications: "boolean",
    timezone: "string",
    fontSize: "number",
    autoSave: "boolean",
    showTips: "boolean",
  };

  for (const [key, value] of Object.entries(preferences)) {
    if (!allowedPreferences[key]) {
      errors.push(`Unknown preference key: ${key}`);
      continue;
    }

    const expectedType = allowedPreferences[key];
    const actualType = typeof value;

    if (actualType !== expectedType) {
      errors.push(
        `Preference '${key}' should be of type ${expectedType}, got ${actualType}`,
      );
    }
  }

  // Validate specific preference values
  if (
    preferences.theme &&
    !["light", "dark", "auto"].includes(preferences.theme)
  ) {
    errors.push("theme must be one of: light, dark, auto");
  }

  if (
    preferences.language &&
    !["en", "es", "fr", "de", "it", "pt"].includes(preferences.language)
  ) {
    errors.push("language must be a valid language code");
  }

  if (
    preferences.fontSize &&
    (preferences.fontSize < 8 || preferences.fontSize > 24)
  ) {
    errors.push("fontSize must be between 8 and 24");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Helper function to save user preferences (replace with actual database update)
async function saveUserPreferences(
  userId: string,
  preferences: Record<string, any>,
): Promise<void> {
  // This is a mock implementation
  // In a real application, you would update the user record in your database
  console.log(`Saving preferences for user ${userId}:`, preferences);
}

// User preferences update tool implementation
export const updateUserPreferencesTool: Tool = {
  name: "updateUserPreferences",
  description: "Update user preferences and settings",

  async execute(input: {
    userId: string;
    preferences: Record<string, any>;
  }): Promise<{
    success: boolean;
    updatedPreferences?: Record<string, any>;
    error?: string;
  }> {
    try {
      // Validate input parameters
      if (!input || !input.userId || !input.preferences) {
        return {
          success: false,
          error: "userId and preferences parameters are required",
        };
      }

      const { userId, preferences } = input;

      // Validate preferences structure
      const validationResult = validatePreferences(preferences);
      if (!validationResult.valid) {
        return {
          success: false,
          error: `Invalid preferences: ${validationResult.errors.join(", ")}`,
        };
      }

      // Get current user data
      const getUserTool = getUserDataTool;
      const userResult = await getUserTool.execute({ userId });

      if (!userResult.success || !userResult.userData) {
        return {
          success: false,
          error: "User not found or could not retrieve user data",
        };
      }

      // Merge new preferences with existing ones
      const currentPreferences = userResult.userData.preferences || {};
      const updatedPreferences = { ...currentPreferences, ...preferences };

      // Mock update (in real implementation, this would update the database)
      await saveUserPreferences(userId, updatedPreferences);

      return {
        success: true,
        updatedPreferences,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error occurred while updating user preferences",
      };
    }
  },
};

// Helper function to generate mock session summary (replace with actual analysis)
function generateSessionSummary(session: any): string {
  const summaries = [
    "General conversation about AI and technology",
    "Discussion about project requirements and implementation",
    "Technical troubleshooting and problem solving",
    "Creative brainstorming and idea generation",
    "Learning and educational content discussion",
  ];

  return (
    summaries[Math.floor(Math.random() * summaries.length)] ||
    "General conversation"
  );
}

// Helper function to generate mock session topics (replace with actual analysis)
function generateSessionTopics(session: any): string[] {
  const allTopics = [
    "AI",
    "Technology",
    "Programming",
    "Design",
    "Business",
    "Education",
    "Science",
    "Health",
    "Entertainment",
    "Sports",
  ];

  // Return 1-3 random topics
  const numTopics = Math.floor(Math.random() * 3) + 1;
  const topics: string[] = [];

  for (let i = 0; i < numTopics; i++) {
    const randomIndex = Math.floor(Math.random() * allTopics.length);
    const randomTopic = allTopics[randomIndex]!;
    if (!topics.includes(randomTopic)) {
      topics.push(randomTopic);
    }
  }

  return topics;
}

// User session history tool implementation
export const getUserSessionHistoryTool: Tool = {
  name: "getUserSessionHistory",
  description: "Get detailed session history for a user",

  async execute(input: {
    userId: string;
    limit?: number;
    sessionId?: string;
  }): Promise<{
    success: boolean;
    sessions?: Array<{
      sessionId: string;
      createdAt: Date;
      lastActive: Date;
      messageCount: number;
      summary?: string;
      topics?: string[];
    }>;
    error?: string;
  }> {
    try {
      // Validate input parameters
      if (!input || !input.userId) {
        return {
          success: false,
          error: "userId parameter is required",
        };
      }

      const { userId, limit = 10, sessionId } = input;

      // Get user data to access session history
      const getUserTool = getUserDataTool;
      const userResult = await getUserTool.execute({ userId });

      if (!userResult.success || !userResult.userData) {
        return {
          success: false,
          error: "User not found or could not retrieve user data",
        };
      }

      let sessions = userResult.userData.sessionHistory || [];

      // Filter by specific session if requested
      if (sessionId) {
        sessions = sessions.filter(
          (session: any) => session.sessionId === sessionId,
        );
      }

      // Sort by last active date (most recent first)
      sessions.sort(
        (a: any, b: any) =>
          new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime(),
      );

      // Apply limit
      if (limit > 0) {
        sessions = sessions.slice(0, limit);
      }

      // Add mock summaries and topics (in real implementation, this would come from analysis)
      const enrichedSessions = sessions.map((session: any) => ({
        ...session,
        summary: generateSessionSummary(session),
        topics: generateSessionTopics(session),
      }));

      return {
        success: true,
        sessions: enrichedSessions,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error occurred while retrieving session history",
      };
    }
  },
};
