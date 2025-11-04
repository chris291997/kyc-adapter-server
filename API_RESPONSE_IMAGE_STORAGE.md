# API Response: Image Storage in Verification Endpoints

## Overview

This document describes the updated response format for verification endpoints, specifically how images are stored and returned when multiple verification steps are performed on the same `verificationId`.

**Date**: January 2025  
**Status**: ✅ **Production Ready**

---

## 📡 Endpoint: `GET /api/v1/verifications/{id}`

### Response Structure

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant-uuid",
  "provider_id": "provider-uuid",
  "account_id": "account-uuid",
  "status": "processing",
  "verification_type": "document",
  "verification_types": ["document", "biometrics"],
  "external_verification_id": "idmeta-12345",
  "external_workflow_url": null,
  "user_email": "user@example.com",
  "user_phone": "+1234567890",
  "user_metadata": {},
  "provider_response": { ... },
  "validated_user_data": { ... },
  "confidence_score": 95.5,
  "is_overridden": false,
  "overridden_by": null,
  "overridden_at": null,
  "override_reason": null,
  "metadata": {
    "request_type": "biometric_verification",
    "flow": "compliance",
    "verification_steps": {
      "biometrics_face_match": {
        "images": {
          "image1": {
            "url": "/uploads/verifications/550e8400-e29b-41d4-a716-446655440000/biometrics_face_match-image1.jpg",
            "mimeType": "image/jpeg",
            "size": 357464
          },
          "image2": {
            "url": "/uploads/verifications/550e8400-e29b-41d4-a716-446655440000/biometrics_face_match-image2.jpg",
            "mimeType": "image/jpeg",
            "size": 348921
          }
        },
        "score": 85.5,
        "completedAt": "2025-01-30T10:00:00.000Z"
      },
      "biometric_verification": {
        "image": {
          "url": "/uploads/verifications/550e8400-e29b-41d4-a716-446655440000/biometric_verification-image.jpg",
          "mimeType": "image/jpeg",
          "size": 334567
        },
        "probability": 0.987,
        "faceId": "face_xyz123abc",
        "completedAt": "2025-01-30T10:05:00.000Z"
      },
      "biometrics_registration": {
        "image": {
          "url": "/uploads/verifications/550e8400-e29b-41d4-a716-446655440000/biometrics_registration-image.jpg",
          "mimeType": "image/jpeg",
          "size": 345678
        },
        "username": "John Doe",
        "faceId": "face_abc123xyz",
        "completedAt": "2025-01-30T09:55:00.000Z"
      },
      "document_verification": {
        "images": {
          "front": {
            "url": "/uploads/verifications/550e8400-e29b-41d4-a716-446655440000/document_verification-front.jpg",
            "mimeType": "image/jpeg",
            "size": 245678
          },
          "back": {
            "url": "/uploads/verifications/550e8400-e29b-41d4-a716-446655440000/document_verification-back.jpg",
            "mimeType": "image/jpeg",
            "size": 238901
          }
        },
        "completedAt": "2025-01-30T09:50:00.000Z"
      },
      "custom_document": {
        "document": {
          "url": "/uploads/verifications/550e8400-e29b-41d4-a716-446655440000/custom_document-document.png",
          "mimeType": "image/png",
          "size": 456789
        },
        "formData": {
          "name": "Michael Reyes",
          "idnumber": "ASIC764839201"
        },
        "completedAt": "2025-01-30T09:45:00.000Z"
      }
    }
  },
  "callback_url": null,
  "webhook_received_at": null,
  "last_webhook_event": null,
  "created_at": "2025-01-30T09:40:00.000Z",
  "updated_at": "2025-01-30T10:05:00.000Z",
  
  // Extracted/computed fields for easy access
  "result": { ... },
  "images": {
    "biometrics_face_match": {
      "images": {
        "image1": {
          "url": "/uploads/verifications/550e8400-e29b-41d4-a716-446655440000/biometrics_face_match-image1.jpg",
          "mimeType": "image/jpeg",
          "size": 357464
        },
        "image2": {
          "url": "/uploads/verifications/550e8400-e29b-41d4-a716-446655440000/biometrics_face_match-image2.jpg",
          "mimeType": "image/jpeg",
          "size": 348921
        }
      }
    },
    "biometric_verification": {
      "image": {
        "url": "/uploads/verifications/550e8400-e29b-41d4-a716-446655440000/biometric_verification-image.jpg",
        "mimeType": "image/jpeg",
        "size": 334567
      }
    },
    "biometrics_registration": {
      "image": {
        "url": "/uploads/verifications/550e8400-e29b-41d4-a716-446655440000/biometrics_registration-image.jpg",
        "mimeType": "image/jpeg",
        "size": 345678
      }
    },
    "document_verification": {
      "images": {
        "front": {
          "url": "/uploads/verifications/550e8400-e29b-41d4-a716-446655440000/document_verification-front.jpg",
          "mimeType": "image/jpeg",
          "size": 245678
        },
        "back": {
          "url": "/uploads/verifications/550e8400-e29b-41d4-a716-446655440000/document_verification-back.jpg",
          "mimeType": "image/jpeg",
          "size": 238901
        }
      }
    },
    "custom_document": {
      "document": {
        "url": "/uploads/verifications/550e8400-e29b-41d4-a716-446655440000/custom_document-document.png",
        "mimeType": "image/png",
        "size": 456789
      }
    }
  },
  "verificationSteps": {
    "biometrics_face_match": {
      "images": { ... },
      "score": 85.5,
      "completedAt": "2025-01-30T10:00:00.000Z"
    },
    "biometric_verification": {
      "image": { ... },
      "probability": 0.987,
      "faceId": "face_xyz123abc",
      "completedAt": "2025-01-30T10:05:00.000Z"
    },
    "biometrics_registration": {
      "image": { ... },
      "username": "John Doe",
      "faceId": "face_abc123xyz",
      "completedAt": "2025-01-30T09:55:00.000Z"
    },
    "document_verification": {
      "images": { ... },
      "completedAt": "2025-01-30T09:50:00.000Z"
    },
    "custom_document": {
      "document": { ... },
      "formData": { ... },
      "completedAt": "2025-01-30T09:45:00.000Z"
    }
  },
  "requestType": "biometric_verification"
}
```

---

## 📋 Field Descriptions

### Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Internal verification UUID |
| `status` | `string` | Current verification status (`pending`, `processing`, `approved`, `rejected`, etc.) |
| `verification_type` | `string` | Primary verification type |
| `verification_types` | `string[]` | Array of all verification types |
| `external_verification_id` | `string` | Provider's verification ID (IDmeta) |
| `result` | `object` | Extracted/validated user data from provider |
| `requestType` | `string` | **Most recent** verification step type |
| `images` | `object` | **All images organized by step type** (see below) |
| `verificationSteps` | `object` | **Full information about each completed step** (see below) |

### `images` Field Structure

The `images` field contains **all images from all verification steps**, organized by step type:

```typescript
{
  [stepType: string]: {
    images?: {
      // For steps with multiple images (face match, document verification)
      [imageKey: string]: {
        url: string;        // Relative path: "/uploads/verifications/{id}/filename.jpg"
        mimeType: string;   // "image/jpeg", "image/png", etc.
        size: number;      // File size in bytes
      }
    },
    image?: {              // For steps with single image (registration, verification)
      url: string;
      mimeType: string;
      size: number;
    },
    document?: {            // For custom document step
      url: string;
      mimeType: string;
      size: number;
    }
  }
}
```

**Step Type Keys**:
- `biometrics_face_match` - Two images (image1, image2)
- `biometric_verification` - Single image
- `biometrics_registration` - Single image
- `document_verification` - Two images (front, back)
- `custom_document` - Single document

### `verificationSteps` Field Structure

The `verificationSteps` field contains **complete information** about each completed verification step:

```typescript
{
  [stepType: string]: {
    // Images (same structure as in images field)
    images?: { ... },
    image?: { ... },
    document?: { ... },
    
    // Step-specific metadata
    score?: number;                    // For face match
    probability?: number;              // For biometric verification
    faceId?: string;                   // For biometric operations
    username?: string;                 // For registration
    formData?: object;                 // For custom document
    
    // Timestamp
    completedAt: string;               // ISO 8601 timestamp
  }
}
```

---

## 📸 Image Structure by Step Type

### 1. Biometrics Face Match

**Step Type**: `biometrics_face_match`

**Structure**:
```json
{
  "images": {
    "biometrics_face_match": {
      "images": {
        "image1": {
          "url": "/uploads/verifications/{id}/biometrics_face_match-image1.jpg",
          "mimeType": "image/jpeg",
          "size": 357464
        },
        "image2": {
          "url": "/uploads/verifications/{id}/biometrics_face_match-image2.jpg",
          "mimeType": "image/jpeg",
          "size": 348921
        }
      }
    }
  },
  "verificationSteps": {
    "biometrics_face_match": {
      "images": { ... },
      "score": 85.5,
      "completedAt": "2025-01-30T10:00:00.000Z"
    }
  }
}
```

**Access**:
```javascript
const faceMatch = status.images.biometrics_face_match;
const img1Url = `${API_BASE_URL}${faceMatch.images.image1.url}`;
const img2Url = `${API_BASE_URL}${faceMatch.images.image2.url}`;
const score = status.verificationSteps.biometrics_face_match.score;
```

---

### 2. Biometric Verification

**Step Type**: `biometric_verification`

**Structure**:
```json
{
  "images": {
    "biometric_verification": {
      "image": {
        "url": "/uploads/verifications/{id}/biometric_verification-image.jpg",
        "mimeType": "image/jpeg",
        "size": 334567
      }
    }
  },
  "verificationSteps": {
    "biometric_verification": {
      "image": { ... },
      "probability": 0.987,
      "faceId": "face_xyz123abc",
      "completedAt": "2025-01-30T10:05:00.000Z"
    }
  }
}
```

**Access**:
```javascript
const verification = status.images.biometric_verification;
const imgUrl = `${API_BASE_URL}${verification.image.url}`;
const probability = status.verificationSteps.biometric_verification.probability;
```

---

### 3. Biometrics Registration

**Step Type**: `biometrics_registration`

**Structure**:
```json
{
  "images": {
    "biometrics_registration": {
      "image": {
        "url": "/uploads/verifications/{id}/biometrics_registration-image.jpg",
        "mimeType": "image/jpeg",
        "size": 345678
      }
    }
  },
  "verificationSteps": {
    "biometrics_registration": {
      "image": { ... },
      "username": "John Doe",
      "faceId": "face_abc123xyz",
      "completedAt": "2025-01-30T09:55:00.000Z"
    }
  }
}
```

**Access**:
```javascript
const registration = status.images.biometrics_registration;
const imgUrl = `${API_BASE_URL}${registration.image.url}`;
const username = status.verificationSteps.biometrics_registration.username;
```

---

### 4. Document Verification

**Step Type**: `document_verification`

**Structure**:
```json
{
  "images": {
    "document_verification": {
      "images": {
        "front": {
          "url": "/uploads/verifications/{id}/document_verification-front.jpg",
          "mimeType": "image/jpeg",
          "size": 245678
        },
        "back": {
          "url": "/uploads/verifications/{id}/document_verification-back.jpg",
          "mimeType": "image/jpeg",
          "size": 238901
        }
      }
    }
  },
  "verificationSteps": {
    "document_verification": {
      "images": { ... },
      "completedAt": "2025-01-30T09:50:00.000Z"
    }
  }
}
```

**Access**:
```javascript
const docVerification = status.images.document_verification;
const frontUrl = `${API_BASE_URL}${docVerification.images.front.url}`;
const backUrl = docVerification.images.back 
  ? `${API_BASE_URL}${docVerification.images.back.url}`
  : null;
```

---

### 5. Custom Document

**Step Type**: `custom_document`

**Structure**:
```json
{
  "images": {
    "custom_document": {
      "document": {
        "url": "/uploads/verifications/{id}/custom_document-document.png",
        "mimeType": "image/png",
        "size": 456789
      }
    }
  },
  "verificationSteps": {
    "custom_document": {
      "document": { ... },
      "formData": {
        "name": "Michael Reyes",
        "idnumber": "ASIC764839201"
      },
      "completedAt": "2025-01-30T09:45:00.000Z"
    }
  }
}
```

**Access**:
```javascript
const customDoc = status.images.custom_document;
const docUrl = `${API_BASE_URL}${customDoc.document.url}`;
const formData = status.verificationSteps.custom_document.formData;
```

---

## 💻 Frontend Implementation Examples

### Example 1: Display All Images from All Steps

```javascript
async function displayAllVerificationImages(verificationId) {
  const API_BASE_URL = 'http://localhost:3000';
  const response = await fetch(`/api/v1/verifications/${verificationId}`);
  const verification = await response.json();
  
  const container = document.getElementById('verification-images');
  
  // Iterate through all verification steps
  Object.keys(verification.images || {}).forEach(stepType => {
    const stepImages = verification.images[stepType];
    const stepInfo = verification.verificationSteps[stepType];
    
    // Create section for this step
    const stepSection = document.createElement('div');
    stepSection.className = 'verification-step';
    stepSection.setAttribute('data-step-type', stepType);
    
    const stepTitle = document.createElement('h3');
    stepTitle.textContent = `Step: ${stepType}`;
    if (stepInfo?.completedAt) {
      stepTitle.textContent += ` (Completed: ${new Date(stepInfo.completedAt).toLocaleString()})`;
    }
    stepSection.appendChild(stepTitle);
    
    // Display images based on step type
    if (stepImages.images) {
      // Multiple images (face match, document verification)
      Object.keys(stepImages.images).forEach(imageKey => {
        const imageData = stepImages.images[imageKey];
        const img = document.createElement('img');
        img.src = `${API_BASE_URL}${imageData.url}`;
        img.alt = `${stepType} - ${imageKey}`;
        img.title = `${imageData.mimeType} (${(imageData.size / 1024).toFixed(2)} KB)`;
        stepSection.appendChild(img);
      });
    } else if (stepImages.image) {
      // Single image (registration, verification)
      const img = document.createElement('img');
      img.src = `${API_BASE_URL}${stepImages.image.url}`;
      img.alt = stepType;
      img.title = `${stepImages.image.mimeType} (${(stepImages.image.size / 1024).toFixed(2)} KB)`;
      stepSection.appendChild(img);
    } else if (stepImages.document) {
      // Custom document
      const img = document.createElement('img');
      img.src = `${API_BASE_URL}${stepImages.document.url}`;
      img.alt = 'Custom Document';
      stepSection.appendChild(img);
    }
    
    // Add step metadata
    if (stepInfo) {
      const metadataDiv = document.createElement('div');
      metadataDiv.className = 'step-metadata';
      
      if (stepInfo.score) {
        metadataDiv.innerHTML += `<p>Similarity Score: ${stepInfo.score}%</p>`;
      }
      if (stepInfo.probability) {
        metadataDiv.innerHTML += `<p>Confidence: ${(stepInfo.probability * 100).toFixed(1)}%</p>`;
      }
      if (stepInfo.username) {
        metadataDiv.innerHTML += `<p>Registered User: ${stepInfo.username}</p>`;
      }
      if (stepInfo.formData) {
        metadataDiv.innerHTML += `<pre>${JSON.stringify(stepInfo.formData, null, 2)}</pre>`;
      }
      
      stepSection.appendChild(metadataDiv);
    }
    
    container.appendChild(stepSection);
  });
}
```

### Example 2: Get Images for Specific Step Type

```javascript
function getImagesForStep(verification, stepType) {
  const stepImages = verification.images?.[stepType];
  const API_BASE_URL = 'http://localhost:3000';
  
  if (!stepImages) {
    return null;
  }
  
  const images = [];
  
  if (stepImages.images) {
    // Multiple images
    Object.keys(stepImages.images).forEach(key => {
      images.push({
        key,
        url: `${API_BASE_URL}${stepImages.images[key].url}`,
        mimeType: stepImages.images[key].mimeType,
        size: stepImages.images[key].size
      });
    });
  } else if (stepImages.image) {
    // Single image
    images.push({
      key: 'image',
      url: `${API_BASE_URL}${stepImages.image.url}`,
      mimeType: stepImages.image.mimeType,
      size: stepImages.image.size
    });
  } else if (stepImages.document) {
    // Document
    images.push({
      key: 'document',
      url: `${API_BASE_URL}${stepImages.document.url}`,
      mimeType: stepImages.document.mimeType,
      size: stepImages.document.size
    });
  }
  
  return images;
}

// Usage
const verification = await getVerification(verificationId);
const faceMatchImages = getImagesForStep(verification, 'biometrics_face_match');
// Returns: [{ key: 'image1', url: '...', ... }, { key: 'image2', url: '...', ... }]
```

### Example 3: Check if Step is Completed

```javascript
function isStepCompleted(verification, stepType) {
  return !!verification.verificationSteps?.[stepType]?.completedAt;
}

function getStepCompletionOrder(verification) {
  const steps = Object.keys(verification.verificationSteps || {});
  return steps
    .map(stepType => ({
      stepType,
      completedAt: new Date(verification.verificationSteps[stepType].completedAt)
    }))
    .sort((a, b) => a.completedAt - b.completedAt);
}

// Usage
const verification = await getVerification(verificationId);
if (isStepCompleted(verification, 'biometrics_face_match')) {
  console.log('Face match step is completed');
}

const completionOrder = getStepCompletionOrder(verification);
// Returns: Array of steps ordered by completion time
```

---

## 📊 Response Comparison

### Single Step (Old Format - Still Supported)

```json
{
  "images": {
    "image": {
      "url": "/uploads/verifications/{id}/image.jpg",
      "mimeType": "image/jpeg",
      "size": 345678
    }
  },
  "requestType": "biometric_verification"
}
```

### Multiple Steps (New Format)

```json
{
  "images": {
    "biometrics_face_match": {
      "images": { "image1": {...}, "image2": {...} }
    },
    "biometric_verification": {
      "image": {...}
    }
  },
  "verificationSteps": {
    "biometrics_face_match": { ... },
    "biometric_verification": { ... }
  },
  "requestType": "biometric_verification"
}
```

---

## 🔍 Key Points

1. **All images preserved**: When the same `verificationId` is used for multiple steps, all images are preserved and organized by step type.

2. **Step identification**: Use step type keys (`biometrics_face_match`, `biometric_verification`, etc.) to access images from specific steps.

3. **Complete metadata**: The `verificationSteps` field contains timestamps, scores, probabilities, and other step-specific data.

4. **Image URLs**: All URLs are relative paths. Prepend your API base URL to construct full URLs.

5. **File organization**: Files are saved with step type prefixes (e.g., `biometrics_face_match-image1.jpg`) to prevent conflicts.

6. **Most recent step**: The `requestType` field indicates the most recent verification step (for backward compatibility).

---

## ✅ Migration Notes

### Backward Compatibility

- Old format still supported (single step images at root level)
- New format adds step organization without breaking existing code
- Both `images` and `verificationSteps` fields are available

### Breaking Changes

**None** - This is a non-breaking enhancement:
- Existing code that doesn't use step-specific organization will continue to work
- New `verificationSteps` field is optional and only present when multiple steps exist
- Images field structure supports both old and new formats

---

## 🔗 Related Endpoints

- `GET /api/v1/verifications/{id}/status` - Returns same structure with status summary
- `POST /api/v1/verifications/biometrics/face-match` - Creates face match step
- `POST /api/v1/verifications/biometrics/verification` - Creates verification step
- `POST /api/v1/verifications/biometrics/registration` - Creates registration step
- `POST /api/v1/verifications/{id}/document` - Creates document verification step
- `POST /api/v1/verifications/custom/document` - Creates custom document step

---

*Last Updated: January 2025*  
*Version: 1.0*

