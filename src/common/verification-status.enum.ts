/**
 * Common Verification Status Enum
 * This enum is provider-agnostic and used across all providers
 * 
 * Numeric values map to standardized verification states
 */
export enum VerificationStatus {
  /** 1 - Verification was rejected */
  REJECTED = 1,
  
  /** 2 - Verification requires manual review */
  REVIEW_NEEDED = 2,
  
  /** 3 - Verification passed all checks and is verified */
  VERIFIED = 3,
  
  /** 4 - Verification is incomplete (missing required steps) */
  INCOMPLETE = 4,
  
  /** 5 - Verification is currently in progress */
  IN_PROGRESS = 5,
  
  /** 6 - Verification failed */
  FAILED = 6,
  
  /** 7 - Verification was purged/deleted */
  PURGED = 7,
}

/**
 * API Request Status Enum
 * Used for tracking API request/response status
 */
export enum ApiRequestStatus {
  /** 0 - Request is pending */
  PENDING = 0,
  
  /** 1 - Request succeeded */
  SUCCESS = 1,
  
  /** 2 - Request failed */
  FAILED = 2,
}

/**
 * Legacy string-based status values (for backward compatibility)
 * These map to the numeric VerificationStatus enum
 */
export type LegacyVerificationStatus =
  | 'pending'
  | 'processing'
  | 'needs_review'
  | 'approved'
  | 'verified'
  | 'rejected'
  | 'expired'
  | 'cancelled';

/**
 * Mapping from legacy string statuses to numeric VerificationStatus
 */
export const LEGACY_TO_NUMERIC_STATUS_MAP: Record<LegacyVerificationStatus, VerificationStatus> = {
  'pending': VerificationStatus.IN_PROGRESS,
  'processing': VerificationStatus.IN_PROGRESS,
  'needs_review': VerificationStatus.REVIEW_NEEDED,
  'approved': VerificationStatus.VERIFIED, // Support legacy 'approved' for backward compatibility
  'verified': VerificationStatus.VERIFIED,
  'rejected': VerificationStatus.REJECTED,
  'expired': VerificationStatus.FAILED,
  'cancelled': VerificationStatus.PURGED,
};

/**
 * Mapping from numeric VerificationStatus to legacy string statuses
 */
export const NUMERIC_TO_LEGACY_STATUS_MAP: Record<VerificationStatus, LegacyVerificationStatus> = {
  [VerificationStatus.REJECTED]: 'rejected',
  [VerificationStatus.REVIEW_NEEDED]: 'needs_review',
  [VerificationStatus.VERIFIED]: 'verified',
  [VerificationStatus.INCOMPLETE]: 'processing', // Map to processing as closest match
  [VerificationStatus.IN_PROGRESS]: 'processing',
  [VerificationStatus.FAILED]: 'rejected', // Map to rejected as closest match
  [VerificationStatus.PURGED]: 'cancelled',
};

/**
 * Convert legacy string status to numeric VerificationStatus
 * Maintains backward compatibility with existing string-based statuses
 */
export function legacyStatusToNumeric(status: LegacyVerificationStatus | string): VerificationStatus {
  const normalizedStatus = status.toLowerCase() as LegacyVerificationStatus;
  return LEGACY_TO_NUMERIC_STATUS_MAP[normalizedStatus] ?? VerificationStatus.IN_PROGRESS;
}

/**
 * Convert numeric VerificationStatus to legacy string status
 * Used when storing in database (which uses string enum)
 */
export function numericStatusToLegacy(status: VerificationStatus | number): LegacyVerificationStatus {
  const numericStatus = typeof status === 'number' ? status : status;
  return NUMERIC_TO_LEGACY_STATUS_MAP[numericStatus as VerificationStatus] ?? 'processing';
}

/**
 * Convert provider-specific status to our standardized numeric VerificationStatus
 * This is the main function providers should use
 * 
 * NOTE: By default, successful provider responses return IN_PROGRESS (processing)
 * unless explicitly finalized via finalize-verification endpoint
 */
export function normalizeProviderStatus(
  providerStatus: number | string | boolean,
  statusMessage?: string,
  context?: { providerName?: string; result?: any; isFinalized?: boolean }
): VerificationStatus {
  // Handle numeric status codes (e.g., from IDmeta)
  if (typeof providerStatus === 'number') {
    switch (providerStatus) {
      case 1:
      case 400:
      case 404:
        return VerificationStatus.REJECTED;
      case 2:
        return VerificationStatus.REVIEW_NEEDED;
      case 3:
      case 200:
        // Only return VERIFIED if explicitly finalized, otherwise return IN_PROGRESS
        return context?.isFinalized ? VerificationStatus.VERIFIED : VerificationStatus.IN_PROGRESS;
      case 4:
        return VerificationStatus.INCOMPLETE;
      case 5:
        return VerificationStatus.IN_PROGRESS;
      case 6:
        return VerificationStatus.FAILED;
      case 7:
        return VerificationStatus.PURGED;
      default:
        return VerificationStatus.IN_PROGRESS;
    }
  }

  // Handle boolean status (e.g., from biometrics APIs)
  if (typeof providerStatus === 'boolean') {
    if (providerStatus === false) {
      return VerificationStatus.REJECTED;
    }
    // For async operations, boolean true means "processing, wait for webhook"
    if (context?.providerName === 'IDmeta' && providerStatus === true) {
      return VerificationStatus.IN_PROGRESS;
    }
    return providerStatus ? VerificationStatus.VERIFIED : VerificationStatus.REJECTED;
  }

  // Handle string statuses
  if (typeof providerStatus === 'string') {
    const upperStatus = providerStatus.toUpperCase();
    
    // Direct matches
    if (upperStatus === 'VERIFIED' || upperStatus === 'APPROVED' || upperStatus === 'SUCCESS') {
      // Only return VERIFIED if explicitly finalized, otherwise return IN_PROGRESS
      return context?.isFinalized ? VerificationStatus.VERIFIED : VerificationStatus.IN_PROGRESS;
    }
    if (upperStatus === 'REJECTED' || upperStatus === 'FAILED' || upperStatus === 'INVALID') {
      return VerificationStatus.REJECTED;
    }
    if (upperStatus === 'REVIEW_NEEDED' || upperStatus === 'NEEDS_REVIEW' || upperStatus === 'PENDING_REVIEW') {
      return VerificationStatus.REVIEW_NEEDED;
    }
    if (upperStatus === 'INCOMPLETE' || upperStatus === 'MISSING_DATA') {
      return VerificationStatus.INCOMPLETE;
    }
    if (upperStatus === 'PROCESSING' || upperStatus === 'IN_PROGRESS' || upperStatus === 'PENDING') {
      return VerificationStatus.IN_PROGRESS;
    }
    if (upperStatus === 'FAILED') {
      return VerificationStatus.FAILED;
    }
    if (upperStatus === 'PURGED' || upperStatus === 'DELETED' || upperStatus === 'CANCELLED') {
      return VerificationStatus.PURGED;
    }
  }

  // Check status message if provided
  if (statusMessage) {
    const upperMessage = statusMessage.toUpperCase();
    if (upperMessage === 'VERIFIED' || upperMessage === 'APPROVED') {
      // Only return VERIFIED if explicitly finalized, otherwise return IN_PROGRESS
      return context?.isFinalized ? VerificationStatus.VERIFIED : VerificationStatus.IN_PROGRESS;
    }
    if (upperMessage === 'REJECTED' || upperMessage === 'FAILED') {
      return VerificationStatus.REJECTED;
    }
    if (upperMessage === 'REVIEW_NEEDED' || upperMessage === 'NEEDS_REVIEW') {
      return VerificationStatus.REVIEW_NEEDED;
    }
  }

  // Default to in progress
  return VerificationStatus.IN_PROGRESS;
}

/**
 * Get legacy string status from numeric status
 * For database storage (which uses string enum)
 */
export function getLegacyStatusForStorage(numericStatus: VerificationStatus): LegacyVerificationStatus {
  return numericStatusToLegacy(numericStatus);
}

/**
 * Get numeric status from legacy string status
 * For API responses or provider-agnostic processing
 */
export function getNumericStatusFromLegacy(legacyStatus: LegacyVerificationStatus): VerificationStatus {
  return legacyStatusToNumeric(legacyStatus);
}

