import { Conversation, ConversationMessage } from "../types";
import { v4 as uuidv4 } from "uuid";
import { ConversationModel, IConversation } from "../models/Conversation";

// Conversation Repository - handles conversation persistence using MongoDB
export class ConversationRepository {
  // Create a new conversation
  async create(
    conversation: Omit<Conversation, "id" | "createdAt" | "updatedAt">,
  ): Promise<Conversation> {
    const newConversation: IConversation = new ConversationModel({
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: conversation.messages || [],
      ...(conversation.metadata && { metadata: conversation.metadata }),
    });

    const savedConversation = await newConversation.save();
    return this.convertToConversation(savedConversation);
  }

  // Find conversation by ID
  async findById(id: string): Promise<Conversation | null> {
    const conversation = await ConversationModel.findOne({ id });
    return conversation ? this.convertToConversation(conversation) : null;
  }

  // Update conversation
  async update(
    id: string,
    updates: Partial<Conversation>,
  ): Promise<Conversation | null> {
    const updatedConversation = await ConversationModel.findOneAndUpdate(
      { id },
      {
        ...updates,
        updatedAt: new Date(),
      },
      { new: true },
    );

    return updatedConversation
      ? this.convertToConversation(updatedConversation)
      : null;
  }

  // Add message to conversation
  async addMessage(
    conversationId: string,
    message: Omit<ConversationMessage, "id" | "timestamp">,
  ): Promise<ConversationMessage | null> {
    const newMessage = {
      id: uuidv4(),
      timestamp: new Date(),
      ...message,
    };

    // Update conversation with new message (embedded)
    const updatedConversation = await ConversationModel.findOneAndUpdate(
      { id: conversationId },
      {
        $push: { messages: newMessage },
        updatedAt: new Date(),
      },
      { new: true },
    );

    if (!updatedConversation) {
      return null;
    }

    // Return the newly added message
    const addedMessage =
      updatedConversation.messages[updatedConversation.messages.length - 1];
    return this.convertToMessage(addedMessage);
  }

  // Get all messages in a conversation
  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    const conversation = await ConversationModel.findOne({
      id: conversationId,
    });
    if (!conversation) return [];

    // Convert MongoDB subdocuments to ConversationMessage format
    return conversation.messages.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      metadata: msg.metadata || {},
    }));
  }

  // Delete conversation
  async delete(id: string): Promise<boolean> {
    const result = await ConversationModel.deleteOne({ id });
    return result.deletedCount > 0;
  }

  // Get all conversations (for debugging)
  async getAll(): Promise<Conversation[]> {
    const conversations = await ConversationModel.find({});
    return conversations.map((conv) => this.convertToConversation(conv));
  }

  // Helper methods to convert MongoDB documents to Conversation types
  private convertToConversation(doc: any): Conversation {
    return {
      id: doc.id,
      messages: doc.messages || [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      metadata: doc.metadata || {},
    };
  }

  private convertToMessage(doc: any): ConversationMessage {
    return {
      id: doc.id,
      role: doc.role,
      content: doc.content,
      timestamp: doc.timestamp,
      metadata: doc.metadata || {},
    };
  }

  // Get conversations by user ID
  async findByUserId(userId: string): Promise<Conversation[]> {
    const conversations = await ConversationModel.find({
      "metadata.userId": userId,
    });
    return conversations.map((conv) => this.convertToConversation(conv));
  }

  // Get conversation count
  async count(): Promise<number> {
    return await ConversationModel.countDocuments();
  }

  // Clear all conversations (for testing)
  async clear(): Promise<void> {
    await ConversationModel.deleteMany({});
  }
}

// Export singleton instance
export const conversationRepository = new ConversationRepository();
