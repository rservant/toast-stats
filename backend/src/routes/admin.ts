/**
 * Admin routes - backward compatibility re-export
 *
 * This file maintains backward compatibility for existing imports.
 * All implementation has been moved to the admin/ directory.
 *
 * New code should import from './admin/index.js' directly.
 *
 * @deprecated Import from './admin/index.js' instead
 */

// Re-export the default router from the admin module
export { default } from './admin/index.js'

// Re-export shared utilities for backward compatibility
export {
  logAdminAccess,
  generateOperationId,
  getServiceFactory,
  type AdminErrorResponse,
  type AdminResponseMetadata,
} from './admin/index.js'
