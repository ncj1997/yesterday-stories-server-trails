# User Trails API Endpoint

## New Endpoint: Get User's Draft Trails

### Endpoint URL
```
GET http://localhost:3001/api/draft-trails/user/:userId
```

### Purpose
Fetches all draft trails created by a specific user that haven't expired.

### Parameters
- **userId** (required, string) - The user ID to fetch drafts for

### Response
```json
{
  "success": true,
  "userId": "user_001",
  "total": 2,
  "drafts": [
    {
      "referenceCode": "REF123456",
      "userId": "user_001",
      "userEmail": "user@example.com",
      "trailData": { ... },
      "status": "draft",
      "createdAt": 1706605800000,
      "expiresAt": 1707210600000,
      "daysRemaining": 5,
      "isExpired": false
    },
    {
      "referenceCode": "REF789012",
      "userId": "user_001",
      "userEmail": "user@example.com",
      "trailData": { ... },
      "status": "payment_completed",
      "createdAt": 1706500000000,
      "expiresAt": 1707104800000,
      "daysRemaining": 4,
      "isExpired": false
    }
  ]
}
```

### Frontend Usage Example

```javascript
// MyTrails.js
const fetchUserTrails = async (userId) => {
  try {
    const response = await fetch(
      `http://localhost:3001/api/draft-trails/user/${userId}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`Found ${data.total} draft(s) for user ${userId}`);
      return data.drafts; // Array of user's draft trails
    }
  } catch (error) {
    console.error('Error fetching user trails:', error);
    return [];
  }
};
```

### Features
✅ Returns only non-expired drafts for the specified user
✅ Automatically cleans up expired drafts
✅ Calculates days remaining for each draft
✅ Marks expired status clearly
✅ Returns total count of user's drafts

### Example Usage with cURL
```bash
curl "http://localhost:3001/api/draft-trails/user/user_001"
```

### All Related Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/draft-trails` | Create new draft |
| GET | `/api/draft-trails/user/:userId` | Get user's drafts ⭐ NEW |
| GET | `/api/draft-trails/:referenceCode` | Get specific draft by reference code |
| GET | `/api/draft-trails` | Get all drafts (admin/debug) |
| PUT | `/api/draft-trails/:referenceCode/status` | Update draft status |
| DELETE | `/api/draft-trails/:referenceCode` | Delete draft |
