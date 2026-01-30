# Mock Server JSON Storage Guide

## Overview
The server now uses JSON file storage instead of in-memory storage. This allows your frontend to persist data across server restarts during testing.

## Data Files

### `data/draftTrails.json`
Contains all draft trail records. Each draft has:
- `referenceCode` - Unique identifier for the draft
- `userId` - User ID who created the draft
- `userEmail` - User email
- `trailData` - The actual story/trail content
- `status` - Draft status (draft, payment_pending, payment_completed, payment_failed)
- `createdAt` - Timestamp when created
- `expiresAt` - Timestamp when draft expires (7 days)
- `daysRemaining` - Calculated days until expiration

## Example Requests

### Save a Draft Trail
```bash
POST /api/draft-trails
Content-Type: application/json

{
  "referenceCode": "REF123456",
  "userId": "user_001",
  "userEmail": "user@example.com",
  "trailData": {
    "title": "My Story",
    "content": "...",
    "chapters": [...]
  }
}
```

### Retrieve a Draft
```bash
GET /api/draft-trails/REF123456
```

### Update Draft Status
```bash
PUT /api/draft-trails/REF123456/status
Content-Type: application/json

{
  "status": "payment_completed"
}
```

### Delete a Draft (after payment)
```bash
DELETE /api/draft-trails/REF123456
```

### List All Drafts
```bash
GET /api/draft-trails
```

## Manual Data Management

You can manually edit the `data/draftTrails.json` file to:
- Add test data
- Modify statuses
- Remove expired entries
- Reset data for testing

Just ensure the JSON syntax is valid when editing manually.

## Data Cleanup

The server automatically:
- Cleans up expired drafts on startup
- Checks expiration when retrieving individual drafts
- Removes expired drafts from the list endpoint

## Storage Benefits

✅ **Persistent** - Data survives server restarts
✅ **Testable** - Easy to inspect and edit test data
✅ **Simple** - No database setup required
✅ **Portable** - Share test data via JSON files
