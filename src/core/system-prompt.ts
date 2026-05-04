import { SystemPrompt } from "../types"; // Import SystemPrompt type
import { mongoConnection } from "../memory/mongo"; // Import MongoDB connection

// System prompt manager for dynamic behavior control
export class SystemPromptManager {
  private collectionName = "system_prompts";

  // Get MongoDB database connection
  private getDb() {
    return mongoConnection.getMongoose().connection.db;
  }

  // In-memory fallback storage
  private memoryPrompts: Map<string, SystemPrompt> = new Map([
    [
      "default",
      {
        id: "default",
        content:
          "You are a helpful AI assistant. Provide clear, accurate, and concise responses.",
        rules: [
          "Always be helpful and respectful",
          "Provide accurate information",
          "Admit when you don't know something",
          "Keep responses focused and relevant",
        ],
        behavior: [
          "Respond in a conversational tone",
          "Ask for clarification when needed",
          "Provide examples when helpful",
        ],
        isActive: true,
      },
    ],
    [
      "technical",
      {
        id: "technical",
        content:
          "You are a technical AI assistant specializing in software development and programming.",
        rules: [
          "Provide technically accurate information",
          "Include code examples when relevant",
          "Explain complex concepts clearly",
          "Consider best practices and security",
        ],
        behavior: [
          "Use precise technical terminology",
          "Structure responses with clear sections",
          "Include practical implementation details",
          "Consider performance implications",
        ],
        isActive: true,
      },
    ],
  ]);

  // Get system prompt by ID
  async getSystemPrompt(id: string = "default"): Promise<SystemPrompt> {
    try {
      // Try MongoDB first
      const db = this.getDb();
      if (db) {
        const doc = await db
          .collection(this.collectionName)
          .findOne({ id, isActive: true });

        if (doc) {
          return {
            id: doc.id,
            content: doc.content,
            rules: doc.rules || [],
            behavior: doc.behavior || [],
            isActive: doc.isActive,
          };
        }
      }

      // Fallback to memory
      const memoryPrompt = this.memoryPrompts.get(id);
      if (memoryPrompt) {
        return memoryPrompt;
      }

      // Return default if not found
      return this.memoryPrompts.get("default")!;
    } catch (error) {
      console.error("Error fetching system prompt:", error);
      // Always return default as fallback
      return this.memoryPrompts.get("default")!;
    }
  }

  // Get all active system prompts
  async getAllActivePrompts(): Promise<SystemPrompt[]> {
    try {
      // Try MongoDB first
      const db = this.getDb();
      if (db) {
        const docs = await db
          .collection(this.collectionName)
          .find({ isActive: true })
          .toArray();

        if (docs.length > 0) {
          return docs.map((doc: any) => ({
            id: doc.id,
            content: doc.content,
            rules: doc.rules || [],
            behavior: doc.behavior || [],
            isActive: doc.isActive,
          }));
        }
      }

      // Fallback to memory
      return Array.from(this.memoryPrompts.values()).filter((p) => p.isActive);
    } catch (error) {
      console.error("Error fetching system prompts:", error);
      return [this.memoryPrompts.get("default")!];
    }
  }

  // Save system prompt to MongoDB and memory
  async saveSystemPrompt(prompt: SystemPrompt): Promise<void> {
    try {
      // Save to MongoDB
      const db = this.getDb();
      if (db) {
        await db.collection(this.collectionName).updateOne(
          { id: prompt.id },
          {
            $set: {
              ...prompt,
              updatedAt: new Date(),
            },
          },
          { upsert: true },
        );
      }

      // Update memory
      this.memoryPrompts.set(prompt.id, prompt);
    } catch (error) {
      console.error("Error saving system prompt:", error);
      // Still save to memory as fallback
      this.memoryPrompts.set(prompt.id, prompt);
    }
  }

  // Delete system prompt
  async deleteSystemPrompt(id: string): Promise<void> {
    try {
      // Delete from MongoDB
      const db = this.getDb();
      if (db) {
        await db.collection(this.collectionName).deleteOne({ id });
      }

      // Remove from memory
      this.memoryPrompts.delete(id);
    } catch (error) {
      console.error("Error deleting system prompt:", error);
      // Still remove from memory
      this.memoryPrompts.delete(id);
    }
  }

  // Build formatted system prompt string
  buildPromptString(prompt: SystemPrompt): string {
    let promptString = prompt.content + "\n\n";

    if (prompt.rules && prompt.rules.length > 0) {
      promptString += "Rules:\n";
      prompt.rules.forEach((rule: string, index: number) => {
        promptString += `${index + 1}. ${rule}\n`;
      });
      promptString += "\n";
    }

    if (prompt.behavior && prompt.behavior.length > 0) {
      promptString += "Behavior Guidelines:\n";
      prompt.behavior.forEach((behavior: string, index: number) => {
        promptString += `${index + 1}. ${behavior}\n`;
      });
    }

    return promptString;
  }

  // Initialize default prompts in MongoDB
  async initializeDefaults(): Promise<void> {
    try {
      const db = this.getDb();
      if (!db) return;

      const defaults = Array.from(this.memoryPrompts.values());

      for (const prompt of defaults) {
        const existing = await db
          .collection(this.collectionName)
          .findOne({ id: prompt.id });

        if (!existing) {
          await db.collection(this.collectionName).insertOne({
            ...prompt,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      console.log("System prompts initialized in MongoDB");
    } catch (error) {
      console.error("Error initializing system prompts:", error);
    }
  }

  // Get prompt based on context
  async getPromptForContext(context: any): Promise<SystemPrompt> {
    // Simple context-based prompt selection
    const taskType = context?.taskType || context?.metadata?.taskType;

    if (
      taskType === "technical" ||
      taskType === "programming" ||
      taskType === "coding"
    ) {
      return await this.getSystemPrompt("technical");
    }

    return await this.getSystemPrompt("default");
  }
}

// Export singleton instance
export const systemPromptManager = new SystemPromptManager();
