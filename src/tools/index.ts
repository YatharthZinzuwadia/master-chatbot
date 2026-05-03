import { Tool, ToolRegistry } from '../types';  // Import tool types

// Tool registry class to manage all available tools
export class ToolManager {
  private static instance: ToolManager;  // Singleton instance
  private tools: ToolRegistry = {};  // Registry of available tools

  // Private constructor for singleton pattern
  private constructor() {
    this.registerDefaultTools();  // Register default tools on initialization
  }

  // Get singleton instance
  public static getInstance(): ToolManager {
    if (!ToolManager.instance) {
      ToolManager.instance = new ToolManager();
    }
    return ToolManager.instance;
  }

  // Register a new tool
  public registerTool(tool: Tool): void {
    if (this.tools[tool.name]) {
      console.warn(`Tool '${tool.name}' already exists. Overwriting...`);
    }
    
    this.tools[tool.name] = tool;
    console.log(`Tool '${tool.name}' registered successfully`);
  }

  // Get a specific tool by name
  public getTool(name: string): Tool | null {
    return this.tools[name] || null;
  }

  // Get all available tools
  public getAllTools(): ToolRegistry {
    return { ...this.tools };  // Return copy to prevent modification
  }

  // Get list of tool names
  public getToolNames(): string[] {
    return Object.keys(this.tools);
  }

  // Check if a tool exists
  public hasTool(name: string): boolean {
    return name in this.tools;
  }

  // Execute a tool by name
  public async executeTool(name: string, input: any): Promise<any> {
    const tool = this.getTool(name);
    
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }

    try {
      console.log(`Executing tool '${name}' with input:`, input);
      const result = await tool.execute(input);
      console.log(`Tool '${name}' executed successfully`);
      return result;
    } catch (error) {
      console.error(`Error executing tool '${name}':`, error);
      throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get tool descriptions for AI context
  public getToolDescriptions(): string {
    const descriptions = Object.values(this.tools).map(tool => 
      `- ${tool.name}: ${tool.description}`
    ).join('\n');
    
    return descriptions || 'No tools available.';
  }

  // Register default tools
  private registerDefaultTools(): void {
    // Import and register default tools
    const { readFileTool } = require('./file.tool');
    const { getUserDataTool } = require('./user.tool');
    
    this.registerTool(readFileTool);
    this.registerTool(getUserDataTool);
  }

  // Validate tool before registration
  private validateTool(tool: Tool): { valid: boolean, errors: string[] } {
    const errors: string[] = [];

    if (!tool.name || typeof tool.name !== 'string') {
      errors.push('Tool must have a valid name');
    }

    if (!tool.description || typeof tool.description !== 'string') {
      errors.push('Tool must have a valid description');
    }

    if (!tool.execute || typeof tool.execute !== 'function') {
      errors.push('Tool must have an execute function');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Remove a tool
  public removeTool(name: string): boolean {
    if (this.hasTool(name)) {
      delete this.tools[name];
      console.log(`Tool '${name}' removed`);
      return true;
    }
    return false;
  }

  // Clear all tools
  public clearTools(): void {
    this.tools = {};
    console.log('All tools cleared');
  }

  // Get tool execution statistics
  public getToolStats(): Record<string, { calls: number, errors: number }> {
    // This would require tracking execution stats
    // For now, return basic info
    const stats: Record<string, { calls: number, errors: number }> = {};
    
    for (const toolName of this.getToolNames()) {
      stats[toolName] = { calls: 0, errors: 0 };
    }
    
    return stats;
  }
}

// Export singleton instance
export const toolManager = ToolManager.getInstance();

// Export convenience functions
export function registerTool(tool: Tool): void {
  toolManager.registerTool(tool);
}

export function getTool(name: string): Tool | null {
  return toolManager.getTool(name);
}

export async function executeTool(name: string, input: any): Promise<any> {
  return toolManager.executeTool(name, input);
}

export function getAllTools(): ToolRegistry {
  return toolManager.getAllTools();
}

export function getToolNames(): string[] {
  return toolManager.getToolNames();
}
