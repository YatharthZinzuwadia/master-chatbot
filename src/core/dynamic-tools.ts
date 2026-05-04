import { Tool, ToolDefinition } from "../types"; // Import Tool types

// Dynamic tool execution manager
export class DynamicToolManager {
  
  // Runtime registry for dynamic tools (not hardcoded to specific backends)
  private dynamicTools: Map<string, Tool> = new Map();
  
  // Register a tool dynamically at runtime
  registerTool(tool: Tool): void {
    console.log(`Registering dynamic tool: ${tool.name}`);
    this.dynamicTools.set(tool.name, tool);
  }
  
  // Register multiple tools from definitions
  registerToolsFromDefinitions(definitions: ToolDefinition[]): void {
    definitions.forEach(def => {
      // Create a generic tool wrapper that uses dynamic input from context
      const tool: Tool = {
        name: def.name,
        description: def.description,
        execute: async (input: any) => {
          return await this.executeToolSafely(def.name, input, def.inputSchema);
        }
      };
      
      this.registerTool(tool);
    });
  }
  
  // Execute tool with safety timeout
  async executeToolSafely(
    toolName: string, 
    input: any, 
    inputSchema: Record<string, any>
  ): Promise<any> {
    
    const tool = this.dynamicTools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    
    // Validate input against schema (simple validation)
    const validationResult = this.validateInput(input, inputSchema);
    if (!validationResult.valid) {
      throw new Error(`Invalid input for tool ${toolName}: ${validationResult.errors.join(', ')}`);
    }
    
    // Execute with timeout for safety
    try {
      const result = await Promise.race([
        tool.execute(input),
        this.timeout(10000) // 10 second timeout
      ]);
      
      console.log(`Tool ${toolName} executed successfully`);
      return result;
    } catch (error) {
      console.error(`Tool ${toolName} execution failed:`, error);
      throw error;
    }
  }
  
  // Get tool by name
  getTool(name: string): Tool | undefined {
    return this.dynamicTools.get(name);
  }
  
  // Get all registered tool names
  getToolNames(): string[] {
    return Array.from(this.dynamicTools.keys());
  }
  
  // Get all tools
  getAllTools(): Record<string, Tool> {
    const result: Record<string, Tool> = {};
    this.dynamicTools.forEach((tool, name) => {
      result[name] = tool;
    });
    return result;
  }
  
  // Unregister tool
  unregisterTool(name: string): boolean {
    return this.dynamicTools.delete(name);
  }
  
  // Clear all dynamic tools
  clearTools(): void {
    this.dynamicTools.clear();
    console.log("All dynamic tools cleared");
  }
  
  // Simple input validation against schema
  private validateInput(
    input: any, 
    schema: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    
    const errors: string[] = [];
    
    // Basic validation - can be extended
    if (schema.required && Array.isArray(schema.required)) {
      schema.required.forEach((field: string) => {
        if (!(field in input)) {
          errors.push(`Missing required field: ${field}`);
        }
      });
    }
    
    // Type validation
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([field, fieldSchema]: [string, any]) => {
        if (field in input) {
          const value = input[field];
          const expectedType = fieldSchema.type;
          
          if (expectedType === 'string' && typeof value !== 'string') {
            errors.push(`Field ${field} must be a string`);
          }
          
          if (expectedType === 'number' && typeof value !== 'number') {
            errors.push(`Field ${field} must be a number`);
          }
          
          if (expectedType === 'boolean' && typeof value !== 'boolean') {
            errors.push(`Field ${field} must be a boolean`);
          }
          
          if (expectedType === 'array' && !Array.isArray(value)) {
            errors.push(`Field ${field} must be an array`);
          }
          
          if (expectedType === 'object' && typeof value !== 'object') {
            errors.push(`Field ${field} must be an object`);
          }
        }
      });
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  // Timeout helper
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Tool execution timeout after ${ms}ms`)), ms);
    });
  }
  
  // Create generic file operation tool
  createFileOperationTool(name: string, operation: 'read' | 'write' | 'delete'): Tool {
    return {
      name,
      description: `Generic ${operation} operation for files`,
      execute: async (input: any) => {
        const filePath = input.filePath;
        
        if (!filePath) {
          throw new Error('filePath is required for file operations');
        }
        
        // Generic implementation - would be replaced by actual file operations
        switch (operation) {
          case 'read':
            return { content: `File content from ${filePath}`, success: true };
          case 'write':
            return { message: `Written to ${filePath}`, success: true };
          case 'delete':
            return { message: `Deleted ${filePath}`, success: true };
          default:
            throw new Error(`Unknown file operation: ${operation}`);
        }
      }
    };
  }
  
  // Create generic data operation tool
  createDataOperationTool(name: string, operation: 'query' | 'insert' | 'update'): Tool {
    return {
      name,
      description: `Generic ${operation} operation for data`,
      execute: async (input: any) => {
        const data = input.data;
        
        // Generic implementation - would be replaced by actual data operations
        switch (operation) {
          case 'query':
            return { results: [`Query results for ${JSON.stringify(data)}`], success: true };
          case 'insert':
            return { message: 'Data inserted successfully', success: true };
          case 'update':
            return { message: 'Data updated successfully', success: true };
          default:
            throw new Error(`Unknown data operation: ${operation}`);
        }
      }
    };
  }
}

// Export singleton instance
export const dynamicToolManager = new DynamicToolManager();
