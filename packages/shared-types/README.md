# @momentum/shared-types

Shared TypeScript types and interfaces for Momentum microservices.

## Usage

```javascript
import {
  createApiResponse,
  createHealthResponse,
} from "@momentum/shared-types";

// Create standardized API response
const response = createApiResponse(true, { message: "Success" });

// Create standardized health response
const health = createHealthResponse("healthy", "core-service", 3000);
```

## Types

### ApiResponse

Standard format for all API responses across services.

### ServiceConfig

Configuration structure for service registry entries.

### HealthResponse

Standardized health check response format.

## Future Enhancements

When TypeScript is added to the project, this package will include:

- Proper TypeScript type definitions (.d.ts files)
- Interface exports for compile-time type checking
- Generic types for service-specific data structures
