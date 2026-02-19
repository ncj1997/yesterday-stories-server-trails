# Sequelize Migration Guide

## Overview

The database has been migrated from storing trail data as JSON to using **separate columns** for better performance, querying, and sorting capabilities. A new **custom_stories** table has been added for modular story management.

## What Changed

### Old Structure (JSON-based)
```javascript
trails {  // Was: draft_trails
  trailData: JSON // All data in one column
}
```

### New Structure (Normalized)
```javascript
trails {  // Renamed from draft_trails
  title: VARCHAR(255)
  description: TEXT
  difficulty: ENUM('Easy', 'Medium', 'Hard')
  distance: DECIMAL(10, 2)
  headerImages: TEXT // JSON array
  headerVideos: TEXT // JSON array
}

custom_stories {
  referenceCode: VARCHAR(100)
  title: VARCHAR(255)
  description: TEXT
  latitude: DECIMAL(10, 8)
  longitude: DECIMAL(11, 8)
  imageUrl: VARCHAR(1000)
  videoUrl: VARCHAR(1000)
  orderIndex: INT
}
```

## Benefits

✅ **Better Performance**: Direct column access vs JSON parsing  
✅ **Efficient Queries**: `WHERE difficulty = 'Easy'` instead of JSON extraction  
✅ **Database Indexes**: Can index difficulty, distance for fast sorting  
✅ **Type Safety**: Proper data types with validation  
✅ **Story Management**: Custom stories are separate records, easier to CRUD  

## Installation

Already installed via:
```bash
npm install sequelize sequelize-cli
```

## Database Setup

### 1. Initialize Database Tables

Run this to create/update all tables:
```bash
npm run db:init
```

This will:
- Create all 6 tables (users, trails, custom_stories, files, tokens, payments)
- Add new columns to existing tables (title, description, difficulty, distance)
- Create custom_stories table
- Apply all indexes

### 2. Migrate Existing Data (Optional)

If you have existing data in the old format, create a migration script:

```javascript
// scripts/migrate-trail-data.js
const { getModels } = require('../src/models');
const { query } = require('../src/db/mysql');

async function migrateTrailData() {
  const { Trail, CustomStory } = getModels();
  
  // Get old records with JSON trailData
  const oldRecords = await query('SELECT * FROM trails WHERE title IS NULL');
  
  for (const record of oldRecords) {
    const trailData = JSON.parse(record.trailData);
    
    // Update trails with separate columns
    await Trail.update({
      title: trailData.title,
      description: trailData.description,
      difficulty: trailData.difficulty,
      distance: parseFloat(trailData.distance),
      headerImages: trailData.headerImages || [],
      headerVideos: trailData.headerVideos || [],
    }, {
      where: { referenceCode: record.referenceCode }
    });
    
    // Migrate custom stories to separate table
    if (trailData.customStories) {
      const stories = trailData.customStories.map((story, index) => ({
        referenceCode: record.referenceCode,
        title: story.title,
        description: story.description,
        latitude: story.latitude,
        longitude: story.longitude,
        imageUrl: story.imageUrl,
        videoUrl: story.videoUrl,
        orderIndex: index,
      }));
      
      await CustomStory.bulkCreate(stories);
    }
  }
  
  console.log('✅ Migration complete');
}

migrateTrailData();
```

## Usage

### Option A: Use Sequelize (Recommended)

**Import the Sequelize service:**
```javascript
const trailsService = require('./services/trailsService');
const { verifyAuthToken } = require('./middleware/auth-sequelize');
```

**Update handler imports:**
```javascript
// In src/handlers/draftTrails.js
const trailsService = require('../services/trailsService');
const { verifyAuthToken } = require('../middleware/auth-sequelize');
```

### Option B: Keep Raw SQL (Old Way)

If you want to keep using raw SQL, no changes needed - but you won't get the benefits of separate columns and custom_stories table.

## API Changes

### Creating a Draft Trail

**Request stays the same:**
```json
POST /draft-trails
{
  "referenceCode": "TRAIL-123",
  "userId": "user-123",
  "userEmail": "user@example.com",
  "trailData": {
    "title": "Historic Tour",
    "description": "A scenic walk",
    "difficulty": "Easy",
    "distance": "12.50",
    "headerImages": ["/uploads/header.jpg"],
    "headerVideos": ["/uploads/intro.mp4"],
    "customStories": [
      {
        "title": "Story 1",
        "description": "First story",
        "latitude": -33.8688,
        "longitude": 151.2093,
        "imageUrl": "/uploads/story1.jpg",
        "videoUrl": "https://video.url"
      }
    ]
  }
}
```

**Backend now:**
- Stores title, description, difficulty, distance in separate columns
- Creates separate records in custom_stories table
- Response format stays identical

### Fetching a Draft Trail

**Response format unchanged:**
```json
{
  "trailData": {
    "title": "Historic Tour",
    "description": "A scenic walk",
    "difficulty": "Easy",
    "distance": "12.50",
    "headerImages": ["/uploads/header.jpg"],
    "headerVideos": ["/uploads/intro.mp4"],
    "customStories": [...]
  }
}
```

**Backend now:**
- Reads from separate columns
- Joins custom_stories table
- Assembles response in same format

## Models Reference

### Trail (was DraftTrail)
```javascript
const { Trail } = getModels();

// Create
await Trail.create({
  referenceCode: 'TRAIL-123',
  userId: 1,
  title: 'My Trail',
  difficulty: 'Easy',
  distance: 12.5,
});

// Find with stories
const trail = await Trail.findOne({
  where: { referenceCode: 'TRAIL-123' },
  include: [{ model: CustomStory, as: 'customStories' }],
});

// Query published trails sorted by distance
const published = await Trail.findAll({
  where: { isPaid: true, difficulty: 'Easy' },
  order: [['distance', 'ASC']],
  limit: 50,
});
```

### CustomStory
```javascript
const { CustomStory } = getModels();

// Create stories for a trail
await CustomStory.bulkCreate([
  {
    referenceCode: 'TRAIL-123',
    title: 'Story 1',
    description: 'First stop',
    latitude: -33.8688,
    longitude: 151.2093,
    imageUrl: '/img/1.jpg',
    orderIndex: 0,
  },
  {
    referenceCode: 'TRAIL-123',
    title: 'Story 2',
    description: 'Second stop',
    latitude: -33.8650,
    longitude: 151.2094,
    videoUrl: 'https://video.url',
    orderIndex: 1,
  },
]);

// Get stories for a trail (ordered)
const stories = await CustomStory.findAll({
  where: { referenceCode: 'TRAIL-123' },
  order: [['orderIndex', 'ASC']],
});
```

## Query Performance Comparison

### Old Way (JSON)
```sql
-- Slow: JSON extraction on every row
SELECT * FROM trails 
WHERE JSON_EXTRACT(trailData, '$.difficulty') = 'Easy'
ORDER BY CAST(JSON_EXTRACT(trailData, '$.distance') AS DECIMAL);
```

### New Way (Columns)
```sql
-- Fast: Direct column access with indexes
SELECT * FROM trails 
WHERE difficulty = 'Easy'
ORDER BY distance;
```

## Environment Setup

No changes to `.env` required. Sequelize uses the same variables:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=yesterday_stories
```

## Files Created

```
src/
├── db/
│   ├── sequelize.js          # Sequelize connection
│   └── init.js               # Database initialization
├── models/
│   ├── index.js              # Model loader & associations
│   ├── User.js
│   ├── Trail.js              # Renamed from DraftTrail, table: trails
│   ├── CustomStory.js        # NEW table
│   ├── File.js
│   ├── Token.js
│   └── Payment.js
├── services/
│   └── trailsService.js      # Sequelize version (renamed)
└── middleware/
    └── auth-sequelize.js     # Sequelize version
```

## Migration Checklist

- [x] Install Sequelize
- [x] Create models with separate columns
- [x] Create custom_stories table
- [x] Update service layer
- [x] Update auth middleware
- [ ] Run `npm run db:init` to create tables
- [ ] Test endpoints with Postman
- [ ] Migrate existing data (if any)
- [ ] Update handler imports to use Sequelize versions
- [ ] Remove old mysql.js queries (optional)

## Next Steps

1. **Run database initialization:**
   ```bash
   npm run db:init
   ```

2. **Update handler files** to use Sequelize services:
   ```javascript
   // In src/handlers/draftTrails.js
   const trailsService = require('../services/trailsService');
   const { verifyAuthToken } = require('../middleware/auth-sequelize');
   ```

3. **Test all endpoints** in Postman to verify behavior

4. **Monitor performance** - queries should be faster with proper indexes

## Troubleshooting

**Error: "Cannot find module 'sequelize'"**
```bash
npm install sequelize
```

**Error: "Table already exists"**
- Safe: Run `npm run db:init` (uses `alter: true` to update schema)
- Fresh start: Manually drop tables and re-run

**Data format mismatch**
- Sequelize service returns `trailData` object in same format as before
- Frontend should work without changes

## Support

For questions about Sequelize models or migration, refer to:
- [Sequelize Docs](https://sequelize.org/docs/v6/)
- [Sequelize Models Guide](https://sequelize.org/docs/v6/core-concepts/model-basics/)
- [Sequelize Associations](https://sequelize.org/docs/v6/core-concepts/assocs/)
