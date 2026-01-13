// Shared types and interfaces for Momentum services
// These will be used across all microservices for consistency

/**
 * Standard API response format
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Whether the operation was successful
 * @property {*} data - The response data (optional)
 * @property {string} error - Error message if success is false (optional)
 * @property {string} timestamp - ISO timestamp of the response
 */

/**
 * Service configuration structure
 * @typedef {Object} ServiceConfig
 * @property {string} name - Service display name
 * @property {string} description - Service description
 * @property {number} port - Service port number
 * @property {string[]} endpoints - List of available endpoints
 * @property {string} healthCheck - Health check endpoint path
 * @property {string} status - Service status (active, inactive, planned)
 */

/**
 * Health check response format
 * @typedef {Object} HealthResponse
 * @property {string} status - Health status (healthy, unhealthy)
 * @property {string} service - Service name
 * @property {string} timestamp - ISO timestamp
 * @property {number} port - Service port
 * @property {Object} details - Additional health details (optional)
 */

// Export type definitions for JSDoc usage
export const Types = {
  ApiResponse: "ApiResponse",
  ServiceConfig: "ServiceConfig",
  HealthResponse: "HealthResponse",
};

// Utility functions for type validation
export const createApiResponse = (success, data = null, error = null) => ({
  success,
  data,
  error,
  timestamp: new Date().toISOString(),
});

export const createHealthResponse = (status, service, port, details = {}) => ({
  status,
  service,
  timestamp: new Date().toISOString(),
  port,
  details,
});
