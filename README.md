# Momentum Monorepo

A monorepo containing the Momentum AI-powered business onboarding platform and its microservices.

## Structure

```
momentum-monorepo/
├── services/
│   └── core/                 # Core AI onboarding service
├── packages/
│   └── shared-types/         # Shared types and utilities
├── modules/                  # Business module definitions
├── service-registry.json     # Service discovery configuration
└── docker-compose.yml        # Development orchestration
```

## Quick Start

### Development

```bash
# Start core service
npm run dev:core

# Or start from root
npm run dev

# Build all services
npm run build
```

### Docker

```bash
# Build and run with Docker Compose
npm run docker:dev

# Or manually
docker-compose up --build
```

## Services

### Core Service (Port 3000)

- **Description**: AI-powered business analysis and onboarding
- **Endpoints**:
  - `POST /api/onboarding/analyze` - Analyze business description
  - `GET /health` - Health check
- **Location**: `services/core/`

## Planned Services

The following services are planned for future development:

- **CRM Service** (Port 3001) - Customer relationship management
- **Analytics Service** (Port 3002) - Business analytics and reporting
- **Marketing Service** (Port 3003) - Marketing automation and campaigns
- **Inventory Service** (Port 3004) - Product inventory management
- **Scheduling Service** (Port 3005) - Appointment scheduling
- **Tasks Service** (Port 3006) - Task and workflow management

## Development Workflow

### Adding New Services

1. Create service directory: `services/{service-name}/`
2. Add service configuration to `service-registry.json`
3. Update `docker-compose.yml` with new service
4. Add npm scripts to root `package.json`

### Shared Packages

Common functionality should be placed in `packages/` and imported by services:

```javascript
import { createApiResponse } from "@momentum/shared-types";
```

## Environment Variables

- `PORT` - Service port (default: 3000 for core)
- `NODE_ENV` - Environment (development/production)
- `GEMINI_API_KEY` - Google Gemini API key for AI functionality
- `USE_MOCK_AI` - Use mock AI responses (default: true)

## Deployment

Each service can be deployed independently using its Dockerfile:

```bash
# Build core service
docker build -t momentum-core ./services/core

# Run core service
docker run -p 3000:3000 momentum-core
```

## Contributing

1. Each service should follow the established patterns
2. Use shared packages for common functionality
3. Maintain consistent API response formats
4. Include health check endpoints for all services
5. Update service registry when adding new services
