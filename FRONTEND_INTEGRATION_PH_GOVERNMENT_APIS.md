# Frontend Integration Guide: Philippines Government Data Verification APIs

## Overview
We've implemented 5 new Philippines government data verification endpoints that allow verification of:
1. **PH LTO Drivers License** - Verify driver's license numbers
2. **PH National Police** - Verify National Police Clearance certificates
3. **PH NBI** - Verify NBI Clearance certificates
4. **PH PRC** - Verify Professional Regulation Commission licenses
5. **PH SSS** - Verify Social Security System numbers

---

## Prerequisites

### Step 1: Create a Verification Session
All government data verification endpoints require an **existing verification ID** that must be created first using:

```
POST /verifications/initiate
```

**Request Body:**
```json
{
  "verificationType": "government_data",
  "userEmail": "user@example.com",
  "templateId": "425",  // Your IDmeta template ID
  "metadata": {
    "firstName": "Juan",
    "lastName": "DELA CRUZ"
  }
}
```

**Response:**
```json
{
  "verificationId": "uuid-here",
  "externalVerificationId": "idmeta-verification-id",
  "status": "pending",
  "statusUrl": "/verifications/uuid-here",
  "websocketChannel": "verification:uuid-here"
}
```

**Important:** Save the `verificationId` from this response - you'll need it for all subsequent API calls.

---

## Authentication

All endpoints support **both authentication methods:**
- **JWT Bearer Token** (for authenticated users)
- **API Key** (for programmatic access)

**Headers:**
```javascript
// For JWT
Authorization: Bearer <your-jwt-token>

// For API Key
X-API-Key: <your-api-key>
```

---

## API Endpoints

### 1. PH LTO Drivers License Verification

**Endpoint:** `POST /verifications/philippines/lto/drivers-license`

**Request Body:**
```json
{
  "verificationId": "uuid-from-initiate-step",
  "templateId": "425",
  "licenseNo": "N01-12-345678"
}
```

**JavaScript Example:**
```javascript
const verifyLtoLicense = async (verificationId, templateId, licenseNo) => {
  const response = await fetch('/verifications/philippines/lto/drivers-license', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}` // or 'X-API-Key': apiKey
    },
    body: JSON.stringify({
      verificationId,
      templateId,
      licenseNo
    })
  });
  
  return await response.json();
};
```

**Response:**
```json
{
  "id": "verification-uuid",
  "status": "approved" | "rejected" | "processing"
}
```

---

### 2. PH National Police Clearance Verification

**Endpoint:** `POST /verifications/philippines/national-police`

**Request Body:**
```json
{
  "verificationId": "uuid-from-initiate-step",
  "templateId": "425",
  "surname": "DELA CRUZ",
  "clearanceNo": "NP-123456-2024"
}
```

**JavaScript Example:**
```javascript
const verifyNationalPolice = async (verificationId, templateId, surname, clearanceNo) => {
  const response = await fetch('/verifications/philippines/national-police', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    },
    body: JSON.stringify({
      verificationId,
      templateId,
      surname,
      clearanceNo
    })
  });
  
  return await response.json();
};
```

**Response:**
```json
{
  "id": "verification-uuid",
  "status": "approved" | "rejected" | "processing"
}
```

---

### 3. PH NBI Clearance Verification

**Endpoint:** `POST /verifications/philippines/nbi`

**Request Body:**
```json
{
  "verificationId": "uuid-from-initiate-step",
  "templateId": "425",
  "clearanceNo": "N-1234567890-2024"
}
```

**JavaScript Example:**
```javascript
const verifyNbi = async (verificationId, templateId, clearanceNo) => {
  const response = await fetch('/verifications/philippines/nbi', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    },
    body: JSON.stringify({
      verificationId,
      templateId,
      clearanceNo
    })
  });
  
  return await response.json();
};
```

**Response:**
```json
{
  "id": "verification-uuid",
  "status": "approved" | "rejected" | "processing"
}
```

---

### 4. PH PRC License Verification

**Endpoint:** `POST /verifications/philippines/prc`

**Important:** PRC verification supports **two search methods**. You must provide **either**:

**Option A: Search by License Number**
```json
{
  "verificationId": "uuid-from-initiate-step",
  "templateId": "425",
  "profession": "Engineer",
  "licenseNo": "123456",
  "dateOfBirth": "1990-01-01"
}
```

**Option B: Search by Name**
```json
{
  "verificationId": "uuid-from-initiate-step",
  "templateId": "425",
  "profession": "Engineer",
  "firstName": "Juan",
  "lastName": "DELA CRUZ"
}
```

**JavaScript Example:**
```javascript
// Search by license
const verifyPrcByLicense = async (verificationId, templateId, profession, licenseNo, dateOfBirth) => {
  const response = await fetch('/verifications/philippines/prc', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    },
    body: JSON.stringify({
      verificationId,
      templateId,
      profession,
      licenseNo,
      dateOfBirth
    })
  });
  
  return await response.json();
};

// Search by name
const verifyPrcByName = async (verificationId, templateId, profession, firstName, lastName) => {
  const response = await fetch('/verifications/philippines/prc', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    },
    body: JSON.stringify({
      verificationId,
      templateId,
      profession,
      firstName,
      lastName
    })
  });
  
  return await response.json();
};
```

**Response:**
```json
{
  "id": "verification-uuid",
  "status": "approved" | "rejected" | "processing"
}
```

**Note:** The API will return `400 Bad Request` if neither search method is fully provided (both licenseNo+dateOfBirth OR both firstName+lastName must be present).

---

### 5. PH SSS Number Verification

**Endpoint:** `POST /verifications/philippines/sss`

**Request Body:**
```json
{
  "verificationId": "uuid-from-initiate-step",
  "templateId": "425",
  "crnSsNumber": "34-1234567-8"
}
```

**JavaScript Example:**
```javascript
const verifySss = async (verificationId, templateId, crnSsNumber) => {
  const response = await fetch('/verifications/philippines/sss', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    },
    body: JSON.stringify({
      verificationId,
      templateId,
      crnSsNumber
    })
  });
  
  return await response.json();
};
```

**Response:**
```json
{
  "id": "verification-uuid",
  "status": "approved" | "rejected" | "processing"
}
```

---

## Real-Time Status Updates

All verification endpoints support **WebSocket** updates on the channel returned from the initial `initiate` call:

**Channel:** `verification:{verificationId}`

**Event Types:**
- `progress` - Verification is processing (e.g., `{ step: 'ph_lto_verification', progress: 25 }`)
- `completed` - Verification finished (e.g., `{ status: 'approved', data: {...} }`)

**Example WebSocket Connection:**
```javascript
const ws = new WebSocket(`wss://your-api-domain/ws`);
const channel = `verification:${verificationId}`;

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'subscribe', channel }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.channel === channel) {
    console.log('Verification update:', data);
    // Handle status updates
    if (data.type === 'completed') {
      // Verification finished
      const status = data.payload.status;
      const result = data.payload.data;
    }
  }
};
```

---

## Polling (Alternative to WebSocket)

If WebSocket is not available, you can poll for status:

**Endpoint:** `GET /verifications/{verificationId}/status`

**Example:**
```javascript
const checkStatus = async (verificationId) => {
  const response = await fetch(`/verifications/${verificationId}/status`, {
    headers: {
      'Authorization': `Bearer ${jwtToken}` // or 'X-API-Key': apiKey
    }
  });
  
  return await response.json();
};
```

**Response:**
```json
{
  "id": "verification-uuid",
  "externalVerificationId": "idmeta-verification-id",
  "status": "approved" | "rejected" | "processing" | "pending",
  "result": {
    // Verified user data from the government database
  }
}
```

---

## Error Handling

All endpoints may return the following errors:

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Verification is not initialized with IDmeta. Initiate a session first to obtain external_verification_id."
}
```

**Solution:** Make sure you call `/verifications/initiate` first to create a verification session.

### 400 Bad Request (PRC specific)
```json
{
  "statusCode": 400,
  "message": "Either (licenseNo and dateOfBirth) or (firstName and lastName) must be provided"
}
```

**Solution:** For PRC verification, provide either both licenseNo+dateOfBirth OR both firstName+lastName.

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Verification not found"
}
```

**Solution:** Check that the verificationId exists and belongs to your tenant.

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Solution:** Check that your JWT token or API key is valid and included in the request headers.

---

## Complete Flow Example

```javascript
// 1. Initiate verification session
const initiateResponse = await fetch('/verifications/initiate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  },
  body: JSON.stringify({
    verificationType: 'government_data',
    userEmail: 'user@example.com',
    templateId: '425'
  })
});

const { verificationId, websocketChannel } = await initiateResponse.json();

// 2. Subscribe to WebSocket updates (optional but recommended)
const ws = new WebSocket(`wss://your-api-domain/ws`);
ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'subscribe', channel: websocketChannel }));
};

// 3. Call the specific verification endpoint
const verifyResponse = await fetch('/verifications/philippines/lto/drivers-license', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  },
  body: JSON.stringify({
    verificationId,
    templateId: '425',
    licenseNo: 'N01-12-345678'
  })
});

const result = await verifyResponse.json();
console.log('Verification started:', result);

// 4. Listen for WebSocket updates or poll status
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.channel === websocketChannel && data.type === 'completed') {
    console.log('Verification completed:', data.payload);
  }
};

// OR poll status
setInterval(async () => {
  const status = await checkStatus(verificationId);
  console.log('Current status:', status.status);
  if (status.status === 'approved' || status.status === 'rejected') {
    clearInterval(interval);
    console.log('Final result:', status.result);
  }
}, 2000);
```

---

## Summary Checklist

- [ ] Create verification session using `POST /verifications/initiate`
- [ ] Save the `verificationId` from the response
- [ ] Call the appropriate government data verification endpoint
- [ ] Include authentication (JWT or API Key) in headers
- [ ] Provide the required fields for the specific verification type
- [ ] Handle WebSocket updates or poll for status
- [ ] Display results to the user based on `status` field

---

## Notes

1. **Template ID**: All endpoints require a valid `templateId` from your IDmeta configuration. Contact backend/admin to get the correct template ID for each verification type.

2. **Verification ID**: The `verificationId` in the request body must match the one returned from `/verifications/initiate`. The backend handles mapping this to IDmeta's external verification ID internally.

3. **Status Values**: Possible status values are:
   - `pending` - Verification hasn't started
   - `processing` - Verification is in progress
   - `approved` - Verification succeeded
   - `rejected` - Verification failed

4. **PRC Search Methods**: PRC is unique - it supports searching by either license number + DOB OR by name. Choose the method based on what information you have available.

5. **Real-time Updates**: Use WebSocket for real-time updates. Polling is a fallback but may have delays.

---

## Support

If you encounter any issues or need clarification on the API endpoints, please contact the backend team.

