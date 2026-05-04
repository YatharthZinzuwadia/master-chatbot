import { z } from "zod"; // Import Zod for schema validation
import dotenv from "dotenv"; // Import dotenv to load environment variables
import { EnvConfig } from "../types"; // Import the EnvConfig type

// Load environment variables from .env file
dotenv.config();

// Define the schema for environment variables with Zod validation
const envSchema = z.object({
  // Server configuration
  PORT: z.string().transform(Number).default("3000"), // Server port, defaults to 3000

  // Database configuration
  MONGODB_URI: z.string().min(1, "MongoDB URI is required"), // MongoDB connection string

  // Model configuration
  MODEL_PROVIDER: z.enum(["gemini", "openai", "groq"], {
    errorMap: (issue, ctx) => ({
      message: 'MODEL_PROVIDER must be either "gemini", "openai", or "groq"',
    }),
  }), // Supported model providers

  MODEL_NAME: z.string().min(1, "Model name is required"), // Model name to use

  // API keys (conditionally required based on provider)
  GEMINI_API_KEY: z.string().optional(), // Gemini API key (optional, validated later)
  OPENAI_API_KEY: z.string().optional(), // OpenAI API key (optional, validated later)
  GROQ_API_KEY: z.string().optional(), // Groq API key (optional, validated later)

  // Model parameters
  MAX_TOKENS: z.string().transform(Number).default("2048"), // Maximum tokens, defaults to 2048
  TEMPERATURE: z.string().transform(Number).default("0.7"), // Temperature, defaults to 0.7

  // Logging configuration
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"), // Log level, defaults to info
});

// Validate and parse environment variables
function validateEnv(): EnvConfig {
  try {
    // Parse and validate environment variables
    const env = envSchema.parse(process.env);

    // Conditional validation for API keys based on provider
    if (env.MODEL_PROVIDER === "gemini" && !env.GEMINI_API_KEY) {
      throw new Error(
        'GEMINI_API_KEY is required when MODEL_PROVIDER is "gemini"',
      );
    }

    if (env.MODEL_PROVIDER === "openai" && !env.OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY is required when MODEL_PROVIDER is "openai"',
      );
    }

    if (env.MODEL_PROVIDER === "groq" && !env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is required when MODEL_PROVIDER is "groq"');
    }

    // Return validated configuration
    return {
      PORT: env.PORT,
      MONGODB_URI: env.MONGODB_URI,
      MODEL_PROVIDER: env.MODEL_PROVIDER,
      MODEL_NAME: env.MODEL_NAME,
      GEMINI_API_KEY: env.GEMINI_API_KEY,
      OPENAI_API_KEY: env.OPENAI_API_KEY,
      GROQ_API_KEY: env.GROQ_API_KEY,
      MAX_TOKENS: env.MAX_TOKENS,
      TEMPERATURE: env.TEMPERATURE,
      LOG_LEVEL: env.LOG_LEVEL,
    };
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      throw new Error(`Environment validation failed: ${errorMessages}`);
    }
    throw error; // Re-throw non-validation errors
  }
}

// Export the validated configuration
export const config = validateEnv();

// Export a function to get configuration (useful for testing)
export function getConfig(): EnvConfig {
  return config;
}

// Export environment variables safely (for debugging)
export function getSafeEnv(): Partial<EnvConfig> {
  const { GEMINI_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, ...safeEnv } = config;
  return {
    ...safeEnv,
    GEMINI_API_KEY: GEMINI_API_KEY ? "***REDACTED***" : undefined,
    OPENAI_API_KEY: OPENAI_API_KEY ? "***REDACTED***" : undefined,
    GROQ_API_KEY: GROQ_API_KEY ? "***REDACTED***" : undefined,
  };
}
