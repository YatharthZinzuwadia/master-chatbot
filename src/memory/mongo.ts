import mongoose from "mongoose"; // Import Mongoose for MongoDB connection
import { config } from "../config/env"; // Import environment configuration
import { DatabaseConfig } from "../types"; // Import DatabaseConfig type

// MongoDB connection class to manage database connections
export class MongoDBConnection {
  private static instance: MongoDBConnection; // Singleton instance
  private isConnected: boolean = false; // Connection status flag

  // Private constructor to enforce singleton pattern
  private constructor() {}

  // Get singleton instance
  public static getInstance(): MongoDBConnection {
    if (!MongoDBConnection.instance) {
      MongoDBConnection.instance = new MongoDBConnection();
    }
    return MongoDBConnection.instance;
  }

  // Connect to MongoDB database
  public async connect(): Promise<void> {
    try {
      // Check if already connected
      if (this.isConnected) {
        console.log("MongoDB already connected");
        return;
      }

      // Extract database name from URI or use default
      const databaseName =
        this.extractDatabaseName(config.MONGODB_URI) || "Chatbot";

      // Connect to MongoDB with options
      await mongoose.connect(config.MONGODB_URI, {
        dbName: databaseName, // Specify database name
        maxPoolSize: 10, // Maximum connection pool size
        serverSelectionTimeoutMS: 5000, // Server selection timeout
        socketTimeoutMS: 45000, // Socket timeout
        bufferCommands: false, // Disable mongoose buffering
      });

      // Set connection flag
      this.isConnected = true;

      console.log(`Connected to MongoDB: ${databaseName}`);

      // Set up connection event listeners
      this.setupEventListeners();
    } catch (error) {
      // Handle connection errors
      console.error("MongoDB connection error:", error);
      throw new Error(
        `Failed to connect to MongoDB: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Disconnect from MongoDB database
  public async disconnect(): Promise<void> {
    try {
      if (!this.isConnected) {
        console.log("MongoDB not connected, skipping disconnect");
        return;
      }

      // Close mongoose connection
      await mongoose.connection.close();

      // Reset connection flag
      this.isConnected = false;

      console.log("Disconnected from MongoDB");
    } catch (error) {
      console.error("MongoDB disconnect error:", error);
      throw new Error(
        `Failed to disconnect from MongoDB: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Get connection status
  public getConnectionStatus(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  // Get mongoose instance for direct access
  public getMongoose(): typeof mongoose {
    return mongoose;
  }

  // Extract database name from MongoDB URI
  private extractDatabaseName(uri: string): string | null {
    try {
      // Parse URI and extract database name
      const parsed = new URL(uri);
      return parsed.pathname?.slice(1) || null; // Remove leading slash
    } catch {
      return null; // Return null if URI parsing fails
    }
  }

  // Set up MongoDB event listeners
  private setupEventListeners(): void {
    const connection = mongoose.connection;

    // Handle connection events
    connection.on("connected", () => {
      console.log("MongoDB connection established");
    });

    connection.on("error", (error) => {
      console.error("MongoDB connection error:", error);
      this.isConnected = false;
    });

    connection.on("disconnected", () => {
      console.log("MongoDB connection disconnected");
      this.isConnected = false;
    });

    // Handle process termination
    process.on("SIGINT", async () => {
      await this.disconnect();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  // Health check for MongoDB connection
  public async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    responseTime?: number;
    error?: string;
  }> {
    try {
      if (!this.isConnected) {
        return { status: "unhealthy", error: "Not connected to MongoDB" };
      }

      const startTime = Date.now();

      // Execute a simple command to test connection
      await mongoose.connection.db?.admin().ping();

      const responseTime = Date.now() - startTime;

      return { status: "healthy", responseTime };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Export singleton instance
export const mongoConnection = MongoDBConnection.getInstance();

// Export database configuration
export const databaseConfig: DatabaseConfig = {
  uri: config.MONGODB_URI,
  database: "Chatbot", // Default database name
  options: {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  },
};
