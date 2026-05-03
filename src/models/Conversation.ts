import mongoose, { Schema, Document, model } from "mongoose";

// Message schema
const MessageSchema = new Schema({
  role: {
    type: String,
    required: true,
    enum: ["user", "assistant"],
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
});

// Conversation schema
const ConversationSchema = new Schema({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  messages: [MessageSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
});

// Create and export only Conversation model
export const ConversationModel = model("Conversation", ConversationSchema);

// Export types
export interface IConversation extends Document {
  id: string;
  messages: any[];
  createdAt: Date;
  updatedAt: Date;
  metadata: any;
}
