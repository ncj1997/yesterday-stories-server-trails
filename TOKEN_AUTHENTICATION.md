# Token-Based Authentication API Guide

## Overview
The API now uses **token-based authentication** instead of sending userIds in URL parameters. Tokens are generated when you save a draft and should be included in the `Authorization` header for all subsequent authenticated requests.

## Authentication Flow

### 1. Create Draft & Get Token
**Endpoint:** `POST /api/draft-trails`

**Request:**
```bash
curl -X POST http://localhost:3001/api/draft-trails \
  -H "Content-Type: application/json" \
  -d '{
    "referenceCode": "YS-20260202-XXXX",
    "userId": "user123",
    "userEmail": "user@example.com",
    "trailData": { ... }
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Draft trail saved successfully",
  "referenceCode": "YS-20260202-XXXX",
  "daysRemaining": 7,
  "token": "base64-encoded-token-here",
  "tokenUsage": "Include in header: Authorization: Bearer <token>"
}
```

### 2. Use Token for Authenticated Requests
Include the token in the `Authorization` header as a Bearer token:

```bash
Authorization: Bearer <token>
```

---

## API Endpoints

### Get User's Drafts
**Endpoint:** `GET /api/draft-trails/my-drafts`

**Headers:**
```
Authorization: Bearer <token>
```

**Example:**
```bash
curl -X GET http://localhost:3001/api/draft-trails/my-drafts \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Response:**
```json
{
  "success": true,
  "userId": "user123",
  "total": 2,
  "drafts": [
    {
      "referenceCode": "YS-20260202-XXXX",
      "userId": "user123",
      "userEmail": "user@example.com",
      "trailData": { ... },
      "status": "draft",
      "createdAt": 1738506000000,
      "expiresAt": 1739110800000,
      "daysRemaining": 7,
      "isExpired": false
    }
  ]
}
```

---

### Get Specific Draft
**Endpoint:** `GET /api/draft-trails/:referenceCode`

**Note:** This endpoint does NOT require authentication (can retrieve by reference code alone)

**Example:**
```bash
curl -X GET http://localhost:3001/api/draft-trails/YS-20260202-XXXX
```

---

### Update Draft Status
**Endpoint:** `PUT /api/draft-trails/:referenceCode/status`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "payment_completed"
}
```

**Example:**
```bash
curl -X PUT http://localhost:3001/api/draft-trails/YS-20260202-XXXX/status \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"status": "payment_completed"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Draft trail status updated",
  "status": "payment_completed"
}
```

---

### Delete Draft
**Endpoint:** `DELETE /api/draft-trails/:referenceCode`

**Headers:**
```
Authorization: Bearer <token>
```

**Example:**
```bash
curl -X DELETE http://localhost:3001/api/draft-trails/YS-20260202-XXXX \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Response:**
```json
{
  "success": true,
  "message": "Draft trail deleted successfully"
}
```

---

## Error Responses

### Missing Token
```json
{
  "error": "Missing Authorization header",
  "hint": "Use: Authorization: Bearer <token>"
}
```

### Invalid Token
```json
{
  "error": "Invalid token",
  "detail": "Token signature invalid"
}
```

### Unauthorized Access (trying to modify another user's draft)
```json
{
  "error": "Unauthorized: You can only delete your own drafts"
}
```

### Draft Not Found
```json
{
  "error": "Draft trail not found"
}
```

---

## Security Features

1. **HMAC-SHA256 Signature**: Tokens are signed to prevent tampering
2. **User Isolation**: Users can only access/modify their own drafts
3. **Token Format**: `base64(userId:timestamp:signature)`
4. **Bearer Token**: Standard `Authorization: Bearer` header format

---

## Backward Compatibility

The old endpoint `GET /api/draft-trails/user/:userId` is still available but **deprecated**. Use `GET /api/draft-trails/my-drafts` with your token instead.

---

## Environment Configuration

Set the `JWT_SECRET` environment variable for production (defaults to a placeholder):
```bash
export JWT_SECRET="your-secure-secret-key-here"
```

**Important:** Change this in production for security!
