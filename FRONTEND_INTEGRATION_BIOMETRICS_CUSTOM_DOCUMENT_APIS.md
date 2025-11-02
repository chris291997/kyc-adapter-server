# Frontend Integration Guide: Biometrics & Custom Document Verification APIs

## Overview
We've implemented 4 new verification endpoints that enable biometric authentication and custom document processing:

1. **Biometrics Face Match** - Compare two facial images for similarity
2. **Biometrics Registration** - Register a user's biometric data (face) with a username
3. **Biometric Verification** - Authenticate identity through biometric liveness and facial recognition
4. **Custom Document Verification** - Upload and extract data from custom documents

---

## Prerequisites

### Step 1: Create a Verification Session
All endpoints require an **existing verification ID** that must be created first using:

```
POST /api/v1/verifications/initiate
```

**Request Body:**
```json
{
  "verificationType": "compliance",  // Use "compliance" for biometrics, "customize" for custom documents
  "userEmail": "user@example.com",
  "templateId": "425",  // Your IDmeta template ID
  "metadata": {
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

**Response:**
```json
{
  "verificationId": "uuid-here",
  "externalVerificationId": "idmeta-verification-id",
  "status": "pending",
  "statusUrl": "/api/v1/verifications/uuid-here",
  "websocketChannel": "verification:uuid-here"
}
```

**Important:** Save the `verificationId` from this response - you'll need it for all subsequent API calls.

---

## Authentication

All endpoints support two authentication methods:

1. **JWT Token** (for Admin/Tenant Dashboard):
   ```
   Authorization: Bearer <jwt_token>
   ```

2. **API Key** (for Client Integration):
   ```
   X-API-Key: <your_api_key>
   ```

---

## API Endpoints

### 1. Biometrics Face Match

**Endpoint:** `POST /api/v1/verifications/biometrics/face-match`

**Purpose:** Compare two facial images to determine if they match (for identity verification).

**Request Body:**
```json
{
  "verificationId": "uuid-from-initiate",
  "templateId": "425",
  "image1": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
  "image2": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD..."
}
```

**Request Parameters:**
- `verificationId` (required): The verification ID from the initiate step
- `templateId` (required): Your IDmeta template identifier
- `image1` (required): First image as base64 data URI (format: `data:image/jpeg;base64,<base64_string>`)
- `image2` (required): Second image as base64 data URI

**Response:**
```json
{
  "id": "uuid-here",
  "status": "approved"  // or "rejected", "processing"
}
```

**Success Response (200 OK):**
- `status: "approved"` - Images match (score ≥ 70)
- `status: "rejected"` - Images don't match (score < 70)
- `status: "processing"` - Verification is still in progress

**JavaScript Example:**
```javascript
async function performFaceMatch(verificationId, templateId, image1Base64, image2Base64) {
  const response = await fetch('/api/v1/verifications/biometrics/face-match', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_JWT_TOKEN',  // OR 'X-API-Key': 'YOUR_API_KEY'
    },
    body: JSON.stringify({
      verificationId,
      templateId,
      image1: `data:image/jpeg;base64,${image1Base64}`,
      image2: `data:image/jpeg;base64,${image2Base64}`,
    }),
  });

  const result = await response.json();
  return result;
}

// Usage
const result = await performFaceMatch(
  'verification-uuid',
  '425',
  image1Base64String,
  image2Base64String
);
console.log('Face match result:', result.status); // "approved" or "rejected"
```

---

### 2. Biometrics Registration

**Endpoint:** `POST /api/v1/verifications/biometrics/registration`

**Purpose:** Register a user's biometric data (face) with a username for future authentication.

**Request Body:**
```json
{
  "verificationId": "uuid-from-initiate",
  "templateId": "425",
  "username": "John Doe",
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD..."
}
```

**Request Parameters:**
- `verificationId` (required): The verification ID from the initiate step
- `templateId` (required): Your IDmeta template identifier
- `username` (required): Username of the person being registered (e.g., "John Doe", "jane.smith@example.com")
- `image` (required): Image used for biometric registration as base64 data URI

**Response:**
```json
{
  "id": "uuid-here",
  "status": "approved"  // or "rejected", "processing"
}
```

**JavaScript Example:**
```javascript
async function registerBiometrics(verificationId, templateId, username, imageBase64) {
  const response = await fetch('/api/v1/verifications/biometrics/registration', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_JWT_TOKEN',
    },
    body: JSON.stringify({
      verificationId,
      templateId,
      username,
      image: `data:image/jpeg;base64,${imageBase64}`,
    }),
  });

  const result = await response.json();
  return result;
}

// Usage
const result = await registerBiometrics(
  'verification-uuid',
  '425',
  'john.doe@example.com',
  userImageBase64
);
```

**Note:** After successful registration, the system stores a `faceId` that can be used for future biometric verification.

---

### 3. Biometric Verification

**Endpoint:** `POST /api/v1/verifications/biometrics/verification`

**Purpose:** Authenticate identity through biometric liveness detection and facial recognition.

**Request Body:**
```json
{
  "verificationId": "uuid-from-initiate",
  "templateId": "425",
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
  "imageBase64": "dGVzdGltYWdlYmFzZTY0"  // Optional alternative
}
```

**Request Parameters:**
- `verificationId` (required): The verification ID from the initiate step
- `templateId` (required): Your IDmeta template identifier
- `image` (required): Image as base64 data URI (format: `data:image/jpeg;base64,<base64_string>`)
- `imageBase64` (optional): Alternative format - base64 encoded image string (without data URI prefix)

**Note:** Provide either `image` (recommended) or `imageBase64`, but at least one is required.

**Response:**
```json
{
  "id": "uuid-here",
  "status": "approved"  // or "rejected", "processing"
}
```

**JavaScript Example:**
```javascript
async function verifyBiometrics(verificationId, templateId, imageBase64) {
  const response = await fetch('/api/v1/verifications/biometrics/verification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_JWT_TOKEN',
    },
    body: JSON.stringify({
      verificationId,
      templateId,
      image: `data:image/jpeg;base64,${imageBase64}`,
    }),
  });

  const result = await response.json();
  return result;
}

// Usage
const result = await verifyBiometrics(
  'verification-uuid',
  '425',
  userImageBase64
);

if (result.status === 'approved') {
  console.log('Biometric verification successful!');
} else {
  console.log('Biometric verification failed');
}
```

---

### 4. Custom Document Verification

**Endpoint:** `POST /api/v1/verifications/custom/document`

**Purpose:** Upload a custom document (e.g., invoices, certificates, forms) and extract structured data from it.

**Request Body:**
```json
{
  "verificationId": "uuid-from-initiate",
  "templateId": "425",
  "document": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...=="  // Optional
}
```

**Request Parameters:**
- `verificationId` (required): The verification ID from the initiate step
- `templateId` (required): Your IDmeta template identifier
- `document` (optional): Document file as base64 data URI (PNG, JPEG, PDF supported)

**Response:**
```json
{
  "id": "uuid-here",
  "status": "approved"  // or "rejected", "processing"
}
```

**JavaScript Example:**
```javascript
async function verifyCustomDocument(verificationId, templateId, documentBase64) {
  const response = await fetch('/api/v1/verifications/custom/document', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_JWT_TOKEN',
    },
    body: JSON.stringify({
      verificationId,
      templateId,
      document: documentBase64 ? `data:image/png;base64,${documentBase64}` : undefined,
    }),
  });

  const result = await response.json();
  return result;
}

// Usage with document
const result = await verifyCustomDocument(
  'verification-uuid',
  '425',
  documentBase64String
);

// Usage without document (if document is already associated with verification)
const resultWithoutDoc = await verifyCustomDocument(
  'verification-uuid',
  '425'
);
```

---

## WebSocket Integration (Real-time Updates)

All endpoints publish real-time updates via WebSocket. Connect to receive verification status updates:

### Connection
```javascript
const ws = new WebSocket('ws://your-server/ws');
const channel = `verification:${verificationId}`;

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: channel
  }));
});
```

### Event: `verification:progress`
Sent during processing:
```json
{
  "event": "verification:progress",
  "verificationId": "uuid-here",
  "data": {
    "step": "biometrics_face_match",  // or "biometrics_registration", "biometric_verification", "custom_document"
    "progress": 25,
    "status": "processing"
  }
}
```

### Event: `verification:updated`
Sent when verification completes:
```json
{
  "event": "verification:updated",
  "verificationId": "uuid-here",
  "externalVerificationId": "idmeta-verification-id",
  "data": {
    "status": "approved",  // or "rejected", "processing"
    "verificationTypes": ["biometrics_face_match"],
    "currentStep": "biometrics_face_match",
    "providerData": {
      "score": 99,  // For face match
      "faceId": "face_abc123xyz",  // For registration/verification
      "probability": 0.987,  // For biometric verification
      "formData": { ... }  // For custom document
    }
  }
}
```

### JavaScript WebSocket Example
```javascript
function connectWebSocket(verificationId) {
  const ws = new WebSocket('ws://your-server/ws');
  const channel = `verification:${verificationId}`;

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: channel
    }));
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    if (message.event === 'verification:progress') {
      console.log('Progress:', message.data.progress, '%');
    }
    
    if (message.event === 'verification:updated') {
      console.log('Status:', message.data.status);
      if (message.data.status === 'approved') {
        console.log('Verification approved!');
        // Handle success
      } else if (message.data.status === 'rejected') {
        console.log('Verification rejected');
        // Handle rejection
      }
    }
  };

  return ws;
}

// Usage
const ws = connectWebSocket(verificationId);
```

---

## Complete Integration Flow Example

Here's a complete example for Biometrics Face Match:

```javascript
async function completeFaceMatchFlow(image1Base64, image2Base64) {
  const templateId = '425';
  const userEmail = 'user@example.com';

  try {
    // Step 1: Create verification session
    const initiateResponse = await fetch('/api/v1/verifications/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_JWT_TOKEN',
      },
      body: JSON.stringify({
        verificationType: 'compliance',
        userEmail,
        templateId,
      }),
    });

    const { verificationId, websocketChannel } = await initiateResponse.json();

    // Step 2: Connect to WebSocket for real-time updates
    const ws = connectWebSocket(verificationId);

    // Step 3: Perform face match
    const faceMatchResponse = await fetch('/api/v1/verifications/biometrics/face-match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_JWT_TOKEN',
      },
      body: JSON.stringify({
        verificationId,
        templateId,
        image1: `data:image/jpeg;base64,${image1Base64}`,
        image2: `data:image/jpeg;base64,${image2Base64}`,
      }),
    });

    const result = await faceMatchResponse.json();

    // Step 4: Wait for WebSocket confirmation or poll status
    return {
      verificationId,
      status: result.status,
      ws,
    };
  } catch (error) {
    console.error('Face match error:', error);
    throw error;
  }
}

// Usage
const { verificationId, status, ws } = await completeFaceMatchFlow(
  image1Base64,
  image2Base64
);
```

---

## Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "statusCode": 400,
  "message": "Biometrics Face Match is only supported for IDmeta provider",
  "error": "Bad Request"
}
```

**400 Bad Request (Verification not initialized):**
```json
{
  "statusCode": 400,
  "message": "Verification is not initialized with IDmeta. Initiate a session first to obtain external_verification_id.",
  "error": "Bad Request"
}
```

**404 Not Found:**
```json
{
  "statusCode": 404,
  "message": "Verification not found",
  "error": "Not Found"
}
```

### JavaScript Error Handling
```javascript
async function safeVerifyBiometrics(verificationId, templateId, imageBase64) {
  try {
    const response = await fetch('/api/v1/verifications/biometrics/verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_JWT_TOKEN',
      },
      body: JSON.stringify({
        verificationId,
        templateId,
        image: `data:image/jpeg;base64,${imageBase64}`,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Verification failed');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Biometric verification error:', error);
    
    if (error.message.includes('not initialized')) {
      // Handle: Create a new verification session first
      console.error('Please initiate a verification session first');
    } else if (error.message.includes('not supported')) {
      // Handle: Provider configuration issue
      console.error('Biometric verification requires IDmeta provider');
    }
    
    throw error;
  }
}
```

---

## Response Data Details

### Getting Full Verification Details

After calling any endpoint, you can get the full verification details including extracted data:

```
GET /api/v1/verifications/{verificationId}
```

**Response includes:**
```json
{
  "id": "uuid-here",
  "status": "approved",
  "validated_user_data": {
    // For Face Match:
    "score": 99,
    
    // For Registration:
    "faceId": "face_abc123xyz",
    "imageUrl": "https://example.com/faces/face_abc123xyz.jpg",
    
    // For Biometric Verification:
    "probability": 0.987,
    "faceId": "face_xyz123abc",
    
    // For Custom Document:
    "formData": {
      "name": "Michael Reyes",
      "idnumber": "ASIC764839201",
      "address": "45 Bonifacio St, Pasay City",
      // ... other extracted fields
    }
  },
  "provider_response": {
    "fullResponse": { ... },
    "result": { ... }
  },
  "metadata": {
    "request_type": "biometrics_face_match",  // or "biometrics_registration", "biometric_verification", "custom_document"
    "flow": "compliance",  // or "customize" for custom documents
    "score": 99,  // For face match
    "faceId": "...",  // For registration/verification
    "probability": 0.987  // For biometric verification
  }
}
```

---

## Status Values

All endpoints return one of these status values:

- **`approved`** - Verification successful
- **`rejected`** - Verification failed
- **`processing`** - Verification is still in progress (may receive updates via WebSocket)

---

## Image Format Requirements

### Base64 Data URI Format
All image parameters should use the **base64 data URI format**:

```
data:image/jpeg;base64,<base64_encoded_string>
```

### Supported Formats
- **JPEG** (`image/jpeg`) - Recommended for photos
- **PNG** (`image/png`) - For screenshots/documents
- **PDF** (`application/pdf`) - For document uploads

### Converting File to Base64 in JavaScript
```javascript
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // Already in data URI format
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Usage
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const base64 = await fileToBase64(file);
// base64 is already in format: "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
```

---

## Summary

### Quick Reference

| Endpoint | Purpose | Required Parameters |
|----------|---------|---------------------|
| `POST /biometrics/face-match` | Compare two images | `verificationId`, `templateId`, `image1`, `image2` |
| `POST /biometrics/registration` | Register user face | `verificationId`, `templateId`, `username`, `image` |
| `POST /biometrics/verification` | Verify identity | `verificationId`, `templateId`, `image` (or `imageBase64`) |
| `POST /custom/document` | Extract document data | `verificationId`, `templateId`, `document` (optional) |

### Implementation Checklist

- [ ] Create verification session using `POST /verifications/initiate`
- [ ] Save `verificationId` from response
- [ ] Set up WebSocket connection for real-time updates
- [ ] Convert images to base64 data URI format
- [ ] Call the appropriate endpoint with `verificationId` and required parameters
- [ ] Handle WebSocket events for progress and completion
- [ ] Poll `GET /verifications/{verificationId}` if WebSocket is unavailable
- [ ] Handle errors gracefully (400, 404, etc.)

---

## Support

For questions or issues, please contact the backend team or refer to the API documentation.

**Last Updated:** January 2025

