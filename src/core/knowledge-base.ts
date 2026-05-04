import { KnowledgeEntry } from "../types"; // Import KnowledgeEntry type
import { mongoConnection } from "../memory/mongo"; // Import MongoDB connection

// Knowledge base manager for project awareness
export class KnowledgeBaseManager {
  private collectionName = "knowledge_base";
  
  // Get MongoDB database connection
  private getDb() {
    return mongoConnection.getMongoose().connection.db;
  }
  
  // In-memory fallback storage
  private memoryKnowledge: Map<string, KnowledgeEntry[]> = new Map([
    ["general", [
      {
        id: "kb-001",
        content: "This is a universal AI assistant that can help with various tasks including coding, analysis, and general questions.",
        keywords: ["ai", "assistant", "help", "universal", "tasks"],
        category: "general",
        relevance: 0.8
      }
    ]],
    ["technical", [
      {
        id: "kb-002", 
        content: "For technical questions, provide specific code examples and explain concepts clearly. Consider best practices and security implications.",
        keywords: ["technical", "code", "programming", "best practices", "security"],
        category: "technical",
        relevance: 0.9
      }
    ]]
  ]);

  // Add knowledge entry
  async addKnowledge(entry: KnowledgeEntry): Promise<void> {
    try {
      // Save to MongoDB
      const db = this.getDb();
      if (db) {
        await db
          .collection(this.collectionName)
          .insertOne({
            ...entry,
            createdAt: new Date()
          });
      }

      // Update memory
      const categoryEntries = this.memoryKnowledge.get(entry.category) || [];
      categoryEntries.push(entry);
      this.memoryKnowledge.set(entry.category, categoryEntries);
    } catch (error) {
      console.error("Error adding knowledge entry:", error);
      // Still save to memory as fallback
      const categoryEntries = this.memoryKnowledge.get(entry.category) || [];
      categoryEntries.push(entry);
      this.memoryKnowledge.set(entry.category, categoryEntries);
    }
  }

  // Get all knowledge entries
  async getAllKnowledge(): Promise<KnowledgeEntry[]> {
    try {
      // Try MongoDB first
      const db = this.getDb();
      if (db) {
        const docs = await db
          .collection(this.collectionName)
          .find({})
          .toArray();
        
        if (docs.length > 0) {
          return docs.map((doc: any) => ({
            id: doc.id,
            content: doc.content,
            keywords: doc.keywords || [],
            category: doc.category,
            relevance: doc.relevance || 0.5
          }));
        }
      }

      // Fallback to memory
      return Array.from(this.memoryKnowledge.values()).flat();
    } catch (error) {
      console.error("Error fetching knowledge entries:", error);
      return Array.from(this.memoryKnowledge.values()).flat();
    }
  }

  // Filter knowledge based on user input (simple keyword-based, no embeddings)
  async getRelevantKnowledge(userInput: string, maxResults: number = 3): Promise<KnowledgeEntry[]> {
    try {
      const allKnowledge = await this.getAllKnowledge();
      
      // Simple keyword-based filtering
      const inputWords = userInput.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2); // Filter out very short words
      
      const scoredEntries = allKnowledge.map(entry => {
        let score = 0;
        
        // Calculate relevance score based on keyword matches
        entry.keywords.forEach(keyword => {
          const lowerKeyword = keyword.toLowerCase();
          
          // Exact word match
          if (inputWords.some(word => word === lowerKeyword)) {
            score += 2;
          }
          
          // Partial match
          if (inputWords.some(word => word.includes(lowerKeyword) || lowerKeyword.includes(word))) {
            score += 1;
          }
          
          // Full input match
          if (userInput.toLowerCase().includes(lowerKeyword)) {
            score += 1.5;
          }
        });
        
        // Consider the entry's predefined relevance
        score += entry.relevance;
        
        return {
          entry,
          score
        };
      });
      
      // Sort by score and return top results
      const relevantEntries = scoredEntries
        .filter(item => item.score > 0) // Only return entries with some relevance
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map(item => item.entry);
      
      console.log(`Found ${relevantEntries.length} relevant knowledge entries for input: "${userInput}"`);
      
      return relevantEntries;
    } catch (error) {
      console.error("Error filtering knowledge:", error);
      return [];
    }
  }

  // Get knowledge by category
  async getKnowledgeByCategory(category: string): Promise<KnowledgeEntry[]> {
    try {
      // Try MongoDB first
      const db = this.getDb();
      if (db) {
        const docs = await db
          .collection(this.collectionName)
          .find({ category })
          .toArray();
        
        if (docs.length > 0) {
          return docs.map((doc: any) => ({
            id: doc.id,
            content: doc.content,
            keywords: doc.keywords || [],
            category: doc.category,
            relevance: doc.relevance || 0.5
          }));
        }
      }

      // Fallback to memory
      return this.memoryKnowledge.get(category) || [];
    } catch (error) {
      console.error("Error fetching knowledge by category:", error);
      return this.memoryKnowledge.get(category) || [];
    }
  }

  // Delete knowledge entry
  async deleteKnowledge(id: string): Promise<void> {
    try {
      // Delete from MongoDB
      const db = this.getDb();
      if (db) {
        await db
          .collection(this.collectionName)
          .deleteOne({ id });
      }

      // Remove from memory
      for (const [category, entries] of this.memoryKnowledge.entries()) {
        const filteredEntries = entries.filter(entry => entry.id !== id);
        this.memoryKnowledge.set(category, filteredEntries);
      }
    } catch (error) {
      console.error("Error deleting knowledge entry:", error);
    }
  }

  // Initialize default knowledge in MongoDB
  async initializeDefaults(): Promise<void> {
    try {
      const db = this.getDb();
      if (!db) return;

      const defaults = Array.from(this.memoryKnowledge.values()).flat();
      
      for (const entry of defaults) {
        const existing = await db
          .collection(this.collectionName)
          .findOne({ id: entry.id });
        
        if (!existing) {
          await db
            .collection(this.collectionName)
            .insertOne({
              ...entry,
              createdAt: new Date()
            });
        }
      }

      console.log("Knowledge base initialized in MongoDB");
    } catch (error) {
      console.error("Error initializing knowledge base:", error);
    }
  }

  // Format knowledge entries for prompt
  formatKnowledgeForPrompt(entries: KnowledgeEntry[]): string {
    if (entries.length === 0) {
      return "No relevant knowledge found.";
    }

    return entries
      .map((entry, index) => 
        `${index + 1}. [${entry.category.toUpperCase()}] ${entry.content}`
      )
      .join('\n');
  }
}

// Export singleton instance
export const knowledgeBaseManager = new KnowledgeBaseManager();
