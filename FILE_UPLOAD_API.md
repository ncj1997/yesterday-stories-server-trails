# File Upload API Documentation

## Endpoint Overview
- **Method:** POST
- **URL:** `/files/batch-presigned-urls`
- **Authentication:** Required (Bearer token in Authorization header)
- **Purpose:** Get presigned AWS S3 URLs to upload multiple files directly to S3

---

## How It Works (Step-by-Step)

### **Step 1: Request Presigned URLs**
Send a POST request with file metadata:

```http
POST /files/batch-presigned-urls
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "files": [
    { "fileName": "photo1.jpg", "contentType": "image/jpeg" },
    { "fileName": "photo2.png", "contentType": "image/png" },
    { "fileName": "video1.mp4", "contentType": "video/mp4" }
  ]
}
```

### **Step 2: Receive URLs**
Backend responds with presigned URLs (each valid for 30 minutes):

```json
{
  "success": true,
  "count": 3,
  "files": [
    {
      "fileName": "photo1.jpg",
      "contentType": "image/jpeg",
      "presignedUrl": "https://amzon-s3-ys-mock-backend.s3.amazonaws.com/...",
      "success": true
    },
    {
      "fileName": "photo2.png",
      "contentType": "image/png",
      "presignedUrl": "https://amzon-s3-ys-mock-backend.s3.amazonaws.com/...",
      "success": true
    },
    {
      "fileName": "video1.mp4",
      "contentType": "video/mp4",
      "presignedUrl": "https://amzon-s3-ys-mock-backend.s3.amazonaws.com/...",
      "success": true
    }
  ]
}
```

### **Step 3: Upload Files to S3**
For each file, upload directly to the presigned URL:

```http
PUT {{presignedUrl}}
Content-Type: image/jpeg

[Binary file data]
```

---

## Supported File Types

### **Images (max 10MB):**
- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`

### **Videos (max 500MB):**
- `video/mp4`
- `video/webm`
- `video/quicktime` (MOV)
- `video/x-msvideo` (AVI)

---

## Important Rules

1. **Content-Type Must Match:** The Content-Type in the PUT request MUST exactly match the contentType in your request
2. **URLs are 30-minute Use-Only:** Each presigned URL can only be used once and expires in 30 minutes
3. **Maximum 50 Files per Batch:** You can request URLs for up to 50 files in one request
4. **File Names Must Not Contain:** `../` or any path separators

---

## Error Handling

| Status | Error | Description |
|--------|-------|-------------|
| **401** | Unauthorized | Invalid or missing JWT token |
| **400** | Bad Request | Invalid JSON, missing files array, or invalid contentType |
| **500** | Server Error | AWS S3 issue or server problem |

---

## Example Implementation (JavaScript)

### 1. Get Presigned URLs
```javascript
async function getPresignedUrls(files, authToken) {
  const fileMetadata = files.map(file => ({
    fileName: file.name,
    contentType: file.type
  }));

  const response = await fetch('/files/batch-presigned-urls', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ files: fileMetadata })
  });

  return await response.json();
}
```

### 2. Upload Files to S3
```javascript
async function uploadToS3(presignedUrl, file) {
  return fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type
    },
    body: file
  });
}
```

### 3. Full Flow
```javascript
const files = [file1, file2, file3];
const authToken = getUserToken();

const { files: urlData } = await getPresignedUrls(files, authToken);

for (let i = 0; i < files.length; i++) {
  await uploadToS3(urlData[i].presignedUrl, files[i]);
  console.log(`✅ Uploaded: ${files[i].name}`);
}
```

---

## Key Benefits

✅ **Secure:** AWS credentials never exposed to frontend  
✅ **Fast:** Direct S3 upload (no server bottleneck)  
✅ **Scalable:** S3 handles millions of concurrent uploads  
✅ **Flexible:** Support images and videos in one request  
✅ **Reliable:** Auto-retry support with presigned URLs  

---

## Flow Diagram

```
Frontend App
    ↓ (Send file metadata)
    ├→ Backend (/files/batch-presigned-urls)
    │   ↓ (Verify auth)
    │   ├→ Generate presigned URLs
    │   ↓ (Return URLs)
    ├→ Frontend App
    │   ↓ (Upload using URLs)
    └→ AWS S3 (Direct upload)
```

---

## Testing in Postman

1. **Set up Environment Variables:**
   - `base_url = http://localhost:3001/dev`
   - `auth_token = YOUR_JWT_TOKEN`

2. **Create Request:**
   - Method: `POST`
   - URL: `{{base_url}}/files/batch-presigned-urls`
   - Headers:
     - `Authorization: Bearer {{auth_token}}`
     - `Content-Type: application/json`

3. **Body (raw JSON):**
   ```json
   {
     "files": [
       { "fileName": "test.jpg", "contentType": "image/jpeg" }
     ]
   }
   ```

4. **Upload to S3:**
   - Copy the `presignedUrl` from response
   - Create new request with `PUT` method
   - Paste URL in request line
   - Body → `binary` → Select file
   - Header: `Content-Type: image/jpeg`
   - Send

---

## Notes

- All URLs are presigned and expire after 30 minutes
- Each URL can only be used once by S3
- Files are stored in organized folders: `images/uploads/{userId}/` and `videos/uploads/{userId}/`
- Upload speed depends on your internet connection and file size
- Success response from S3 PUT is typically 200 OK with empty body
