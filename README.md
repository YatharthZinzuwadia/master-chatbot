# AI Copilot Backend Service

A production-grade, modular AI Copilot backend service built with Node.js and TypeScript. This system provides an AI orchestration engine with support for multiple model providers, conversation memory, tool execution, and a comprehensive API layer.

## Features

- **Layered Architecture**: Clean separation of concerns with orchestrator, model adapters, tools, and memory layers
- **Multiple Model Providers**: Support for Google Gemini and OpenAI (easily extensible for others)
- **Conversation Memory**: MongoDB-based session and message storage with Mongoose
- **Tool System**: Lightweight tool registry with example tools for file operations and user data
- **Modular Prompts**: Dynamic prompt building for system, chat, and state update scenarios
- **RESTful API**: Express-based API with comprehensive endpoints
- **Structured Logging**: Request-scoped logging with multiple levels
- **Error Handling**: Comprehensive error handling with custom error types
- **Health Checks**: Multiple health check endpoints for monitoring
- **Graceful Shutdown**: Proper cleanup and shutdown handling

## Architecture

```
┌─────────────────┐
│   API Layer     │  (Express routes & middleware)
├─────────────────┤
│  Orchestrator   │  (Request processing & intent detection)
├─────────────────┤
│ Model Adapters  │  (Gemini, OpenAI, etc.)
├─────────────────┤
│  Tool System    │  (File operations, user data, etc.)
├─────────────────┤
│ Prompt System   │  (System, chat, state update prompts)
├─────────────────┤
│   Memory Layer  │  (MongoDB sessions & messages)
└─────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 5.0+
- TypeScript 4.8+

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd universal-chatbot
```

2. Install dependencies:

```bash
npm install
```

3. Copy environment template:

```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/chatbot

# Model Provider Configuration
MODEL_PROVIDER=gemini
MODEL_NAME=gemini-1.5-pro
GEMINI_API_KEY=your_gemini_api_key_here

# Model Configuration
MAX_TOKENS=2048
TEMPERATURE=0.7

# Logging Configuration
LOG_LEVEL=info
```

5. Start MongoDB (if not already running):

```bash
mongod
```

6. Build and run the application:

```bash
npm run build
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## API Testing Guide

### Server Information

- **Base URL**: `http://localhost:3000` (check your `.env` for PORT)
- **Content-Type**: `application/json`

### Health Check Endpoints

#### 1. Basic Health Check

```bash
GET /api/health
```

**Response**: Overall service health status (MongoDB, Model Adapter, Memory, Disk)

#### 2. Detailed Health Check

```bash
GET /api/health/detailed
```

**Response**: System info, configuration, service details, performance metrics

#### 3. Readiness Check

```bash
GET /api/health/ready
```

**Response**: Kubernetes readiness probe (MongoDB + Model status)

#### 4. Liveness Check

```bash
GET /api/health/live
```

**Response**: Basic process liveness status

### Copilot Endpoints

#### 1. Process Message (Main Chat Endpoint)

```bash
POST /api/copilot/run
```

**Payload**:

```json
{
  "message": "Hello, how can you help me?",
  "sessionId": "optional-session-id",
  "context": {}
}
```

**Response**: AI response with conversation metadata

#### 2. Get Conversation History

```bash
GET /api/copilot/history/{sessionId}?limit=50&includeMetadata=false
```

**Parameters**:

- `sessionId`: Required conversation ID
- `limit`: Optional message count (default: 50)
- `includeMetadata`: Optional boolean (default: false)

#### 3. Get Session Information

```bash
GET /api/copilot/session/{sessionId}
```

**Response**: Session details, message count, duration

#### 4. Delete Session

```bash
DELETE /api/copilot/session/{sessionId}
```

**Response**: Deletion confirmation with message count

#### 5. Get Available Tools

```bash
GET /api/copilot/tools
```

**Response**: List of available AI tools and descriptions

#### 6. Get Orchestrator Statistics

```bash
GET /api/copilot/stats
```

**Response**: System usage statistics

### Documentation Endpoints

#### 1. Root Info

```bash
GET /
```

**Response**: Server info and endpoint list

#### 2. API Documentation

```bash
GET /api/docs
```

**Response**: Complete API documentation

## Quick Testing Steps

### 1. Check Server Health

```bash
curl http://localhost:3000/api/health
```

### 2. Start a Conversation

```bash
curl -X POST http://localhost:3000/api/copilot/run \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, what can you do?"}'
```

### 3. Continue Conversation (use returned sessionId)

```bash
curl -X POST http://localhost:3000/api/copilot/run \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me more", "sessionId": "session-id-from-previous-response"}'
```

### 4. Check Conversation History

```bash
curl http://localhost:3000/api/copilot/history/{sessionId}
```

### 5. View Available Tools

```bash
curl http://localhost:3000/api/copilot/tools
```

### 6. Get Detailed System Info

```bash
curl http://localhost:3000/api/health/detailed
```

**Response Format**: All endpoints return JSON with `success`, `data`, and `timestamp` fields. Error responses include an `error` field.

## Configuration

### Environment Variables

| Variable         | Required | Default     | Description                        |
| ---------------- | -------- | ----------- | ---------------------------------- |
| `PORT`           | No       | 3000        | Server port                        |
| `NODE_ENV`       | No       | development | Environment                        |
| `MONGODB_URI`    | Yes      | -           | MongoDB connection string          |
| `MODEL_PROVIDER` | Yes      | -           | Model provider (gemini, openai)    |
| `MODEL_NAME`     | Yes      | -           | Model name                         |
| `GEMINI_API_KEY` | Yes\*    | -           | Google Gemini API key              |
| `OPENAI_API_KEY` | Yes\*    | -           | OpenAI API key                     |
| `MAX_TOKENS`     | No       | 2048        | Maximum tokens for model responses |
| `TEMPERATURE`    | No       | 0.7         | Model temperature                  |
| `LOG_LEVEL`      | No       | info        | Logging level                      |

\*Required based on the chosen model provider

## Development

### Project Structure

```
src/
├── api/                    # API routes and middleware
│   └── routes/
├── config/                 # Configuration and environment
├── core/                   # Core business logic
│   ├── orchestrator.ts    # Main request orchestrator
│   ├── intent.ts          # Intent detection
│   └── context-builder.ts # Context building
├── memory/                 # Database layer
│   ├── mongo.ts           # MongoDB connection
│   ├── chat.repo.ts       # Session repository
│   └── message.repo.ts    # Message repository
├── models/                 # Model adapters
│   ├── base.ts            # Base adapter interface
│   ├── gemini.ts          # Gemini adapter
│   └── index.ts           # Model factory
├── prompts/                # Prompt templates
│   ├── system.prompt.ts   # System prompts
│   ├── chat.prompt.ts     # Chat prompts
│   └── state.prompt.ts    # State update prompts
├── tools/                  # Tool system
│   ├── index.ts           # Tool manager
│   ├── file.tool.ts       # File operations
│   └── user.tool.ts       # User data operations
├── types/                  # TypeScript types
│   └── index.ts
├── utils/                  # Utilities
│   ├── logger.ts          # Logging system
│   └── errors.ts          # Error handling
└── server.ts              # Main server file
```

### Adding New Tools

1. Create a new tool file in `src/tools/`:

```typescript
import { Tool } from "../types";

export const myTool: Tool = {
  name: "myTool",
  description: "Description of my tool",
  async execute(input: any): Promise<any> {
    // Tool implementation
    return { success: true, result: "tool result" };
  },
};
```

2. Register the tool in `src/tools/index.ts`:

```typescript
import { myTool } from "./my.tool";

// In registerDefaultTools method
this.registerTool(myTool);
```

### Adding New Model Providers

1. Create a new adapter in `src/models/`:

```typescript
import { BaseModelAdapter } from "./base";

export class MyModelAdapter extends BaseModelAdapter {
  getProvider(): string {
    return "my-provider";
  }

  async generateResponse(prompt: string, config?: any): Promise<string> {
    // Model implementation
    return "model response";
  }
}
```

2. Update the model factory in `src/models/index.ts` to include your provider.

### Testing

Run tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

## Deployment

### Docker

Build Docker image:

```bash
docker build -t ai-copilot-backend .
```

Run with Docker:

```bash
docker run -p 3000:3000 --env-file .env ai-copilot-backend
```

### Environment Variables for Production

For production deployment, ensure these environment variables are set:

- `NODE_ENV=production`
- `LOG_LEVEL=warn` or `error`
- Proper MongoDB connection string
- Valid API keys for your model provider
- Consider using secrets management for API keys

## Monitoring

### Health Checks

The service provides multiple health check endpoints:

- `/api/health` - Basic health status
- `/api/health/detailed` - Detailed system information
- `/api/health/ready` - Kubernetes readiness probe
- `/api/health/live` - Kubernetes liveness probe

### Logging

Structured logging with request tracing:

```typescript
import { createRequestLogger } from "./utils/logger";

const logger = createRequestLogger(requestId);
logger.info("Processing request", { userId, sessionId });
```

Log levels: `error`, `warn`, `info`, `debug`

## Security

- Input validation on all API endpoints
- Rate limiting considerations
- API key protection
- CORS configuration
- Security headers via Helmet middleware

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:

1. Check the API documentation at `/api/docs`
2. Review the health check endpoints
3. Check the application logs
4. Verify environment configuration

## Performance Considerations

- MongoDB connection pooling
- Request timeout handling
- Memory usage monitoring
- Token usage tracking
- Circuit breaker patterns for external services

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Verify MongoDB is running
   - Check connection string in `.env`
   - Ensure network connectivity

2. **Model API Errors**
   - Verify API keys are correct
   - Check model provider status
   - Review rate limits

3. **High Memory Usage**
   - Monitor log retention
   - Check for memory leaks
   - Review session cleanup

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
```

This will provide detailed request tracing and error information.
