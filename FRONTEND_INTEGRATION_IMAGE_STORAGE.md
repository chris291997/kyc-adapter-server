# Frontend Integration Guide: Image Storage in Verification Responses

## Overview

All verification endpoints that accept images now **automatically save** those images and **include image URLs** in the verification response. This allows the frontend to display images for specific verification steps.

**Date**: January 2025  
**Status**: ✅ **All endpoints updated**

---

## 🎯 What Changed

### **Before** (No Image Storage)
- Images were sent to the provider but not saved
- No way to display images after verification
- Images were lost after the API call

### **After** (Image Storage Enabled)
- All images are automatically saved to the server
- Image URLs are included in verification responses
- Frontend can display images for each verification step
- Images organized by verification ID

---

## 📸 Which Endpoints Save Images?

All endpoints that accept images now save them:

1. ✅ **Document Verification** - `POST /api/v1/verifications/{id}/document`
   - Saves: `imageFrontSide`, `imageBackSide` (optional)

2. ✅ **Biometrics Face Match** - `POST /api/v1/verifications/biometrics/face-match`
   - Saves: `image1`, `image2`

3. ✅ **Biometrics Registration** - `POST /api/v1/verifications/biometrics/registration`
   - Saves: `image`

4. ✅ **Biometric Verification** - `POST /api/v1/verifications/biometrics/verification`
   - Saves: `image` or `imageBase64`

5. ✅ **Custom Document** - `POST /api/v1/verifications/custom/document`
   - Saves: `document` (optional)

---

## 📡 Updated Response Format

### **GET `/api/v1/verifications/{id}`**
### **GET `/api/v1/verifications/{id}/status`**

**New Fields Added**:
- `images` (object) - **All images organized by verification step** (see structure below)
- `verificationSteps` (object) - Full information about each verification step including timestamps
- `requestType` (string) - Most recent verification step type (e.g., "biometrics_face_match")

### **Important: Multiple Steps on Same VerificationId**

When the same `verificationId` is used for multiple verification steps (e.g., face match AND biometric verification), **all images are preserved and organized by step type**.

**Response Structure**:
```json
{
  "id": "verification-uuid",
  "status": "processing",
  "requestType": "biometric_verification",  // Most recent step
  "images": {
    // All images organized by step type
    "biometrics_face_match": {
      "images": {
        "image1": { "url": "...", "mimeType": "...", "size": ... },
        "image2": { "url": "...", "mimeType": "...", "size": ... }
      }
    },
    "biometric_verification": {
      "image": { "url": "...", "mimeType": "...", "size": ... }
    },
    "biometrics_registration": {
      "image": { "url": "...", "mimeType": "...", "size": ... }
    }
  },
  "verificationSteps": {
    "biometrics_face_match": {
      "images": { ... },
      "score": 85.5,
      "completedAt": "2025-01-30T10:00:00Z"
    },
    "biometric_verification": {
      "image": { ... },
      "probability": 0.987,
      "completedAt": "2025-01-30T10:05:00Z"
    }
  }
}
```

---

## 📋 Response Examples by Endpoint

### 1. Document Verification (Front & Back Images)

**Endpoint**: `POST /api/v1/verifications/{id}/document`

**Response Structure**:
```json
{
  "id": "verification-uuid",
  "status": "processing",
  "requestType": "document_verification",
  "images": {
    "images": {
      "front": {
        "url": "/uploads/verifications/{verificationId}/document-front.jpg",
        "mimeType": "image/jpeg",
        "size": 245678
      },
      "back": {
        "url": "/uploads/verifications/{verificationId}/document-back.jpg",
        "mimeType": "image/jpeg",
        "size": 238901
      }
    }
  },
  "result": { ... },
  "createdAt": "2025-01-30T10:00:00Z",
  "updatedAt": "2025-01-30T10:05:00Z"
}
```

**Frontend Implementation**:
```javascript
const status = await getVerificationStatus(verificationId);

if (status.images?.images) {
  // Document verification - front and back images
  const frontImageUrl = `${API_BASE_URL}${status.images.images.front.url}`;
  const backImageUrl = status.images.images.back 
    ? `${API_BASE_URL}${status.images.images.back.url}`
    : null;
  
  // Display images
  document.getElementById('doc-front').src = frontImageUrl;
  if (backImageUrl) {
    document.getElementById('doc-back').src = backImageUrl;
  }
}
```

---

### 2. Biometrics Face Match (Two Images)

**Endpoint**: `POST /api/v1/verifications/biometrics/face-match`

**Response Structure**:
```json
{
  "id": "verification-uuid",
  "status": "processing",
  "requestType": "biometrics_face_match",
  "images": {
    "images": {
      "image1": {
        "url": "/uploads/verifications/{verificationId}/image1.jpg",
        "mimeType": "image/jpeg",
        "size": 357464
      },
      "image2": {
        "url": "/uploads/verifications/{verificationId}/image2.jpg",
        "mimeType": "image/jpeg",
        "size": 348921
      }
    }
  },
  "result": { ... },
  "metadata": {
    "score": 85.5
  }
}
```

**Frontend Implementation**:
```javascript
const status = await getVerificationStatus(verificationId);

if (status.requestType === 'biometrics_face_match' && status.images?.images) {
  const image1Url = `${API_BASE_URL}${status.images.images.image1.url}`;
  const image2Url = `${API_BASE_URL}${status.images.images.image2.url}`;
  
  // Display both images side by side
  document.getElementById('face-match-image1').src = image1Url;
  document.getElementById('face-match-image2').src = image2Url;
  
  // Show comparison score if available
  if (status.metadata?.score) {
    document.getElementById('similarity-score').textContent = 
      `Similarity: ${status.metadata.score}%`;
  }
}
```

---

### 3. Biometrics Registration (Single Image)

**Endpoint**: `POST /api/v1/verifications/biometrics/registration`

**Response Structure**:
```json
{
  "id": "verification-uuid",
  "status": "processing",
  "requestType": "biometrics_registration",
  "images": {
    "image": {
      "url": "/uploads/verifications/{verificationId}/registration-image.jpg",
      "mimeType": "image/jpeg",
      "size": 345678
    }
  },
  "result": { ... },
  "metadata": {
    "username": "John Doe",
    "faceId": "face_abc123xyz"
  }
}
```

**Frontend Implementation**:
```javascript
const status = await getVerificationStatus(verificationId);

if (status.requestType === 'biometrics_registration' && status.images?.image) {
  const imageUrl = `${API_BASE_URL}${status.images.image.url}`;
  
  document.getElementById('registration-image').src = imageUrl;
  
  if (status.metadata?.username) {
    document.getElementById('registered-user').textContent = 
      `Registered: ${status.metadata.username}`;
  }
}
```

---

### 4. Biometric Verification (Single Image)

**Endpoint**: `POST /api/v1/verifications/biometrics/verification`

**Response Structure**:
```json
{
  "id": "verification-uuid",
  "status": "processing",
  "requestType": "biometric_verification",
  "images": {
    "image": {
      "url": "/uploads/verifications/{verificationId}/verification-image.jpg",
      "mimeType": "image/jpeg",
      "size": 334567
    }
  },
  "result": { ... },
  "metadata": {
    "probability": 0.987,
    "faceId": "face_xyz123abc"
  }
}
```

**Frontend Implementation**:
```javascript
const status = await getVerificationStatus(verificationId);

if (status.requestType === 'biometric_verification' && status.images?.image) {
  const imageUrl = `${API_BASE_URL}${status.images.image.url}`;
  
  document.getElementById('verification-image').src = imageUrl;
  
  if (status.metadata?.probability) {
    const confidence = (status.metadata.probability * 100).toFixed(1);
    document.getElementById('confidence').textContent = 
      `Match Confidence: ${confidence}%`;
  }
}
```

---

### 5. Custom Document (Single Document)

**Endpoint**: `POST /api/v1/verifications/custom/document`

**Response Structure**:
```json
{
  "id": "verification-uuid",
  "status": "processing",
  "requestType": "custom_document",
  "images": {
    "document": {
      "url": "/uploads/verifications/{verificationId}/custom-document.png",
      "mimeType": "image/png",
      "size": 456789
    }
  },
  "result": {
    "formData": { ... }
  }
}
```

**Frontend Implementation**:
```javascript
const status = await getVerificationStatus(verificationId);

if (status.requestType === 'custom_document' && status.images?.document) {
  const documentUrl = `${API_BASE_URL}${status.images.document.url}`;
  
  // Display document
  document.getElementById('custom-document').src = documentUrl;
  
  // Display extracted form data
  if (status.result?.formData) {
    const formData = status.result.formData;
    document.getElementById('extracted-name').textContent = formData.name;
    document.getElementById('extracted-id').textContent = formData.idnumber;
    // ... etc
  }
}
```

---

## 🎨 Universal Image Display Helper

Here's a reusable helper function to display **all images from all verification steps**:

```javascript
/**
 * Display ALL images from ALL verification steps
 * @param {Object} verificationStatus - Status from getVerificationStatus()
 * @param {string} API_BASE_URL - Your API base URL
 */
function displayAllVerificationImages(verificationStatus, API_BASE_URL) {
  const { images, verificationSteps } = verificationStatus;
  
  if (!images || Object.keys(images).length === 0) {
    console.log('No images available for this verification');
    return;
  }
  
  // Iterate through all verification steps
  Object.keys(images).forEach(stepType => {
    const stepImages = images[stepType];
    
    switch (stepType) {
      case 'document_verification':
        // Document verification - front and back
        if (stepImages.images?.front) {
          displayImage(`${API_BASE_URL}${stepImages.images.front.url}`, 'document-front', stepType);
        }
        if (stepImages.images?.back) {
          displayImage(`${API_BASE_URL}${stepImages.images.back.url}`, 'document-back', stepType);
        }
        break;
        
      case 'biometrics_face_match':
        // Face match - two images
        if (stepImages.images?.image1) {
          displayImage(`${API_BASE_URL}${stepImages.images.image1.url}`, 'face-match-image1', stepType);
        }
        if (stepImages.images?.image2) {
          displayImage(`${API_BASE_URL}${stepImages.images.image2.url}`, 'face-match-image2', stepType);
        }
        // Show step metadata if available
        if (verificationSteps[stepType]?.score) {
          displayStepInfo(stepType, `Similarity Score: ${verificationSteps[stepType].score}%`);
        }
        break;
        
      case 'biometrics_registration':
        // Registration - single image
        if (stepImages.image) {
          displayImage(`${API_BASE_URL}${stepImages.image.url}`, 'registration-image', stepType);
        }
        if (verificationSteps[stepType]?.username) {
          displayStepInfo(stepType, `Registered: ${verificationSteps[stepType].username}`);
        }
        break;
        
      case 'biometric_verification':
        // Verification - single image
        if (stepImages.image) {
          displayImage(`${API_BASE_URL}${stepImages.image.url}`, 'verification-image', stepType);
        }
        if (verificationSteps[stepType]?.probability) {
          const confidence = (verificationSteps[stepType].probability * 100).toFixed(1);
          displayStepInfo(stepType, `Confidence: ${confidence}%`);
        }
        break;
        
      case 'custom_document':
        // Custom document
        if (stepImages.document) {
          displayImage(`${API_BASE_URL}${stepImages.document.url}`, 'custom-document', stepType);
        }
        break;
        
      default:
        console.log(`Unknown step type: ${stepType}`);
    }
  });
}

function displayImage(url, elementId, stepType) {
  // Create or find image element
  let img = document.getElementById(elementId);
  if (!img) {
    img = document.createElement('img');
    img.id = elementId;
    img.setAttribute('data-step-type', stepType);
    document.getElementById('verification-images-container').appendChild(img);
  }
  img.src = url;
  img.style.display = 'block';
  
  // Add step type label
  const label = document.createElement('div');
  label.className = 'step-label';
  label.textContent = `Step: ${stepType}`;
  img.parentNode.insertBefore(label, img);
}

function displayStepInfo(stepType, info) {
  const infoDiv = document.createElement('div');
  infoDiv.className = 'step-info';
  infoDiv.setAttribute('data-step-type', stepType);
  infoDiv.textContent = info;
  document.getElementById('verification-info-container').appendChild(infoDiv);
}
```

---

## 📊 Image URL Format

All image URLs follow this pattern:

```
/uploads/verifications/{verificationId}/{filename}
```

**Full URL Example**:
```
http://localhost:3000/uploads/verifications/550e8400-e29b-41d4-a716-446655440000/image1.jpg
```

**Note**: The `/uploads` prefix is configured in the server. Images are automatically served as static files.

---

## 🔍 Response Structure Summary

### Image Structure Patterns

| Endpoint | `requestType` | `images` Structure |
|----------|---------------|-------------------|
| Document Verification | `"document_verification"` | `images.images.front`<br>`images.images.back` |
| Face Match | `"biometrics_face_match"` | `images.images.image1`<br>`images.images.image2` |
| Registration | `"biometrics_registration"` | `images.image` |
| Biometric Verification | `"biometric_verification"` | `images.image` |
| Custom Document | `"custom_document"` | `images.document` |

### Image Metadata Format

Each image object contains:
```typescript
{
  url: string;      // Relative path: "/uploads/verifications/{id}/filename.jpg"
  mimeType: string; // MIME type: "image/jpeg", "image/png", etc.
  size: number;     // File size in bytes
}
```

---

## ✅ Migration Checklist

### Frontend Updates Required:

- [ ] Update verification status display to check for `images` field
- [ ] Add image display components for each verification type
- [ ] Handle different image structures based on `requestType`:
  - [ ] Document verification (front/back)
  - [ ] Face match (image1/image2)
  - [ ] Single image endpoints (image)
  - [ ] Custom document (document)
- [ ] Add error handling for missing images
- [ ] Add loading states while images load
- [ ] Test with all 5 endpoint types

### Backward Compatibility

✅ **Non-breaking change** - New fields are added, existing code continues to work:
- Old code that doesn't check `images` will still function
- Images field is optional (may be `null` if no images were provided)
- `requestType` is optional and only present for endpoints that save images

---

## 🚨 Important Notes

### 1. **Image URLs are Relative**
Always prepend your API base URL:
```javascript
const fullUrl = `${API_BASE_URL}${image.url}`;
// Example: "http://localhost:3000/uploads/verifications/{id}/image1.jpg"
```

### 2. **Images May Not Always Be Present**
Check if images exist before displaying:
```javascript
if (status.images && status.images.image) {
  // Safe to display image
}
```

### 3. **Request Type Indicates Verification Step**
Use `requestType` to determine which UI to show:
- `"document_verification"` → Show document images
- `"biometrics_face_match"` → Show side-by-side comparison
- `"biometrics_registration"` → Show registered user image
- `"biometric_verification"` → Show verification image
- `"custom_document"` → Show custom document

### 4. **Images Are Stored Immediately**
Images are saved when the API call is made, so they're available even if verification is still `"processing"`.

---

## 📝 Example: Complete Frontend Flow

```javascript
// 1. Call biometrics face match
const response = await fetch('/api/v1/verifications/biometrics/face-match', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    verificationId: 'existing-verification-id',
    templateId: '425',
    image1: 'data:image/jpeg;base64,...',
    image2: 'data:image/jpeg;base64,...',
  }),
});

// 2. Get verification status (images are now included)
const status = await getVerificationStatus('existing-verification-id');

// 3. Display images
if (status.requestType === 'biometrics_face_match' && status.images?.images) {
  const container = document.getElementById('face-match-container');
  
  // Image 1
  const img1 = document.createElement('img');
  img1.src = `${API_BASE_URL}${status.images.images.image1.url}`;
  img1.alt = 'Face Match Image 1';
  container.appendChild(img1);
  
  // Image 2
  const img2 = document.createElement('img');
  img2.src = `${API_BASE_URL}${status.images.images.image2.url}`;
  img2.alt = 'Face Match Image 2';
  container.appendChild(img2);
  
  // Show verification step indicator
  const indicator = document.createElement('div');
  indicator.textContent = `Verification Step: ${status.requestType}`;
  indicator.className = 'verification-step';
  container.appendChild(indicator);
}
```

---

## 🔗 Quick Reference

### Get Verification Status
```javascript
GET /api/v1/verifications/{id}/status
```

**Response includes**:
- ✅ `images` - Image URLs and metadata
- ✅ `requestType` - Verification step identifier
- ✅ All existing fields (unchanged)

### Image Access
```javascript
// Pattern
{API_BASE_URL}/uploads/verifications/{verificationId}/{filename}

// Examples
http://localhost:3000/uploads/verifications/abc123/image1.jpg
http://localhost:3000/uploads/verifications/abc123/document-front.jpg
```

---

## ✅ Testing Checklist

Test each endpoint to verify images are returned:

- [ ] Document Verification - Check `images.images.front` and `images.images.back`
- [ ] Face Match - Check `images.images.image1` and `images.images.image2`
- [ ] Registration - Check `images.image`
- [ ] Biometric Verification - Check `images.image`
- [ ] Custom Document - Check `images.document`
- [ ] Verify images are accessible via URLs
- [ ] Test with missing optional images (back side, custom document)

---

## 🎯 Summary

**What Changed**:
- ✅ Images are now automatically saved for all image-based endpoints
- ✅ Image URLs are included in verification responses
- ✅ `requestType` field added to identify verification step
- ✅ Images organized by verification ID

**What Frontend Needs to Do**:
1. Check for `images` field in verification responses
2. Display images based on `requestType`
3. Handle different image structures (multiple images vs single image)
4. Build image URLs by prepending API base URL

**Ready for**: Frontend integration ✅

---

*Last Updated: January 2025*  
*All endpoints now support image storage and retrieval*

