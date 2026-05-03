import { Tool } from "../types"; // Import Tool type
import * as fs from "fs"; // Import Node.js file system module
import * as path from "path"; // Import Node.js path module

// File reading tool implementation
export const readFileTool: Tool = {
  name: "readFile",
  description: "Read the contents of a text file from the file system",

  // Execute function for reading files
  async execute(input: { filePath: string; encoding?: string }): Promise<{
    success: boolean;
    content?: string;
    error?: string;
    metadata?: {
      size: number;
      encoding: string;
      lastModified: Date;
    };
  }> {
    try {
      // Validate input parameters
      if (!input || !input.filePath) {
        return {
          success: false,
          error: "filePath parameter is required",
        };
      }

      const { filePath, encoding = "utf8" } = input;

      // Resolve the file path (make it absolute)
      const resolvedPath = path.resolve(filePath);

      // Security check: prevent reading sensitive system files
      if (this.isSensitivePath && this.isSensitivePath(resolvedPath)) {
        return {
          success: false,
          error: "Access to this file path is not allowed for security reasons",
        };
      }

      // Check if file exists
      if (!fs.existsSync(resolvedPath)) {
        return {
          success: false,
          error: `File not found: ${resolvedPath}`,
        };
      }

      // Check if it's actually a file (not a directory)
      const stats = fs.statSync(resolvedPath);
      if (!stats.isFile()) {
        return {
          success: false,
          error: `Path is not a file: ${resolvedPath}`,
        };
      }

      // Check file size (prevent reading extremely large files)
      const maxSize = 1024 * 1024; // 1MB limit
      if (stats.size > maxSize) {
        return {
          success: false,
          error: `File is too large (${stats.size} bytes). Maximum size is ${maxSize} bytes`,
        };
      }

      // Read the file content
      const content = fs.readFileSync(resolvedPath, {
        encoding: encoding as BufferEncoding,
      });

      return {
        success: true,
        content,
        metadata: {
          size: stats.size,
          encoding,
          lastModified: stats.mtime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error occurred while reading file",
      };
    }
  },

  // Helper method to check for sensitive paths
  isSensitivePath(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath).toLowerCase();

    // List of sensitive system paths to block
    const sensitivePaths = [
      "/etc",
      "/usr/bin",
      "/usr/sbin",
      "/bin",
      "/sbin",
      "/proc",
      "/sys",
      "/dev",
      "c:\\windows",
      "c:\\program files",
      "c:\\program files (x86)",
      "c:\\users",
      "c:\\programdata",
    ];

    // Check if the path contains any sensitive directories
    return sensitivePaths.some((sensitivePath) =>
      normalizedPath.startsWith(sensitivePath),
    );
  },
};

// File writing tool implementation
export const writeFileTool: Tool = {
  name: "writeFile",
  description:
    "Write content to a text file (creates new file or overwrites existing)",

  async execute(input: {
    filePath: string;
    content: string;
    encoding?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    metadata?: {
      bytesWritten: number;
      encoding: string;
      filePath: string;
    };
  }> {
    try {
      // Validate input parameters
      if (!input || !input.filePath || input.content === undefined) {
        return {
          success: false,
          error: "filePath and content parameters are required",
        };
      }

      const { filePath, content, encoding = "utf8" } = input;

      // Resolve the file path
      const resolvedPath = path.resolve(filePath);

      // Security check: prevent writing to sensitive system files
      if (
        readFileTool.isSensitivePath &&
        readFileTool.isSensitivePath(resolvedPath)
      ) {
        return {
          success: false,
          error: "Access to this file path is not allowed for security reasons",
        };
      }

      // Create directory if it doesn't exist
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Check content size (prevent writing extremely large files)
      const maxSize = 1024 * 1024; // 1MB limit
      if (Buffer.byteLength(content, encoding as BufferEncoding) > maxSize) {
        return {
          success: false,
          error: `Content is too large. Maximum size is ${maxSize} bytes`,
        };
      }

      // Write the file
      fs.writeFileSync(resolvedPath, content, {
        encoding: encoding as BufferEncoding,
      });

      return {
        success: true,
        metadata: {
          bytesWritten: Buffer.byteLength(content, encoding as BufferEncoding),
          encoding,
          filePath: resolvedPath,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error occurred while writing file",
      };
    }
  },
};

// File listing tool implementation
export const listFilesTool: Tool = {
  name: "listFiles",
  description: "List files and directories in a specified directory",

  async execute(input: {
    directoryPath: string;
    showHidden?: boolean;
  }): Promise<{
    success: boolean;
    files?: Array<{
      name: string;
      type: "file" | "directory";
      size?: number;
      lastModified?: Date;
    }>;
    error?: string;
  }> {
    try {
      // Validate input parameters
      if (!input || !input.directoryPath) {
        return {
          success: false,
          error: "directoryPath parameter is required",
        };
      }

      const { directoryPath, showHidden = false } = input;

      // Resolve the directory path
      const resolvedPath = path.resolve(directoryPath);

      // Security check: prevent listing sensitive directories
      if (
        readFileTool.isSensitivePath &&
        readFileTool.isSensitivePath(resolvedPath)
      ) {
        return {
          success: false,
          error: "Access to this directory is not allowed for security reasons",
        };
      }

      // Check if directory exists
      if (!fs.existsSync(resolvedPath)) {
        return {
          success: false,
          error: `Directory not found: ${resolvedPath}`,
        };
      }

      // Check if it's actually a directory
      const stats = fs.statSync(resolvedPath);
      if (!stats.isDirectory()) {
        return {
          success: false,
          error: `Path is not a directory: ${resolvedPath}`,
        };
      }

      // Read directory contents
      const items = fs.readdirSync(resolvedPath);

      // Process each item
      const files = items
        .filter((item) => showHidden || !item.startsWith(".")) // Filter hidden files if requested
        .map((item) => {
          const itemPath = path.join(resolvedPath, item);
          const itemStats = fs.statSync(itemPath);

          const result: {
            name: string;
            type: "file" | "directory";
            size?: number;
            lastModified?: Date;
          } = {
            name: item,
            type: itemStats.isDirectory()
              ? ("directory" as const)
              : ("file" as const),
            lastModified: itemStats.mtime,
          };

          if (itemStats.isFile()) {
            result.size = itemStats.size;
          }

          return result;
        })
        .sort((a, b) => {
          // Sort directories first, then files, both alphabetically
          if (a.type === "directory" && b.type === "file") return -1;
          if (a.type === "file" && b.type === "directory") return 1;
          return a.name.localeCompare(b.name);
        });

      return {
        success: true,
        files,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error occurred while listing files",
      };
    }
  },
};

// File deletion tool implementation
export const deleteFileTool: Tool = {
  name: "deleteFile",
  description: "Delete a file from the file system",

  async execute(input: { filePath: string }): Promise<{
    success: boolean;
    error?: string;
    metadata?: {
      deletedPath: string;
    };
  }> {
    try {
      // Validate input parameters
      if (!input || !input.filePath) {
        return {
          success: false,
          error: "filePath parameter is required",
        };
      }

      const { filePath } = input;

      // Resolve the file path
      const resolvedPath = path.resolve(filePath);

      // Security check: prevent deleting sensitive system files
      if (
        readFileTool.isSensitivePath &&
        readFileTool.isSensitivePath(resolvedPath)
      ) {
        return {
          success: false,
          error: "Access to this file path is not allowed for security reasons",
        };
      }

      // Check if file exists
      if (!fs.existsSync(resolvedPath)) {
        return {
          success: false,
          error: `File not found: ${resolvedPath}`,
        };
      }

      // Check if it's a file (not a directory)
      const stats = fs.statSync(resolvedPath);
      if (!stats.isFile()) {
        return {
          success: false,
          error: `Path is not a file: ${resolvedPath}`,
        };
      }

      // Delete the file
      fs.unlinkSync(resolvedPath);

      return {
        success: true,
        metadata: {
          deletedPath: resolvedPath,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error occurred while deleting file",
      };
    }
  },
};
