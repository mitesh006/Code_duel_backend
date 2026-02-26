# Background Job Queue System - Implementation Guide

## Overview

The evaluation system has been refactored to use **BullMQ** with Redis for asynchronous, scalable background job processing. This eliminates blocking during evaluation and allows parallel processing of multiple evaluations.

---

## Architecture

### Before (Synchronous)
```
Cron Job → Process Challenge 1 → Process Challenge 2 → ... (Sequential)
   ↓
Evaluate Member 1 → Evaluate Member 2 → ... (Sequential)
   ↓
Blocks server during entire evaluation process
```

### After (Asynchronous with Queue)
```
Cron Job → Push Challenge Jobs to Queue → Return Immediately
   ↓
Queue → Worker Pool (10 concurrent workers)
   ↓
Process 10 member evaluations simultaneously
   ↓
Server remains responsive
```

---

## Components

### 1. **Queue Configuration** (`src/config/queue.js`)
- Configures Redis connection
- Creates BullMQ evaluation queue
- Sets retry policies and job cleanup rules

### 2. **Worker** (`src/workers/evaluation.worker.js`)
- Processes jobs from the queue
- Handles two job types:
  - `challenge-evaluation`: Creates member evaluation jobs
  - `member-evaluation`: Evaluates individual members
- Runs 10 concurrent jobs with rate limiting (20 jobs/sec)

### 3. **Evaluation Service** (`src/services/evaluation.service.js`)
- `runDailyEvaluationWithQueue()`: NEW - Queue-based evaluation
- `runDailyEvaluation()`: DEPRECATED - Legacy synchronous evaluation

### 4. **Cron Job** (`src/config/cron.js`)
- Updated to call `runDailyEvaluationWithQueue()`
- Pushes jobs to queue instead of processing directly

---

## Setup Instructions

### Prerequisites
You need **Redis** installed and running.

#### Option 1: Install Redis Locally (Windows)
1. Download Redis from https://github.com/microsoftarchive/redis/releases
2. Extract and run `redis-server.exe`
3. Default: `localhost:6379`

#### Option 2: Use Docker
```bash
docker run -d -p 6379:6379 redis:latest
```

#### Option 3: Use Redis Cloud (Free Tier)
1. Sign up at https://redis.com/try-free/
2. Create a free database
3. Update `.env` with connection details

### Environment Variables
Add to your `.env` file:
```env
# Redis Configuration
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### Install Dependencies
Already installed with BullMQ refactor:
```bash
npm install bullmq ioredis
```

---

## How It Works

### 1. **Daily Cron Trigger (1 AM)**
```javascript
// Cron job triggers
runDailyEvaluationWithQueue()
  ↓
// Finds active challenges
// Pushes jobs to queue
{
  name: "challenge-evaluation",
  data: { challengeId, evaluationDate }
}
```

### 2. **Worker Processes Challenge Job**
```javascript
// Worker picks up challenge job
processChallengeEvaluation()
  ↓
// Creates member jobs
{
  name: "member-evaluation",
  data: { challenge, member, evaluationDate }
}
  ↓
// Queues 10, 50, 100+ member jobs
```

### 3. **Worker Processes Member Jobs (10 at a time)**
```javascript
// 10 workers process in parallel
processMemberEvaluation()
  ↓
// Fetch LeetCode submissions
// Check requirements
// Update database
// Apply penalties/streaks
```

---

## Benefits

### 1. **Non-Blocking**
- Server remains responsive during evaluation
- API endpoints work normally during 1 AM evaluation

### 2. **Parallel Processing**
- 10 members evaluated simultaneously
- 100 members: ~10 iterations instead of 100 sequential calls

### 3. **Fault Tolerance**
- Auto-retry on failure (3 attempts with exponential backoff)
- Jobs persist in Redis if server crashes

### 4. **Rate Limiting**
- Built-in rate limiting (20 jobs/second)
- Prevents LeetCode API abuse

### 5. **Monitoring**
- Job status tracking
- Failed job retention for debugging
- Detailed logging

---

## Monitoring & Management

### Check Queue Status
Create a simple monitoring endpoint (optional):

```javascript
// Add to routes
router.get('/api/admin/queue/stats', async (req, res) => {
  const { evaluationQueue } = require('../config/queue');
  
  const waiting = await evaluationQueue.getWaitingCount();
  const active = await evaluationQueue.getActiveCount();
  const completed = await evaluationQueue.getCompletedCount();
  const failed = await evaluationQueue.getFailedCount();
  
  res.json({ waiting, active, completed, failed });
});
```

### Clear Failed Jobs
```javascript
const { evaluationQueue } = require('./src/config/queue');
await evaluationQueue.clean(0, 10000, 'failed'); // Remove failed jobs
```

---

## Configuration Options

### Worker Concurrency
Edit `src/workers/evaluation.worker.js`:
```javascript
concurrency: 10, // Change to 5, 15, 20, etc.
```

### Rate Limiting
```javascript
limiter: {
  max: 20,      // Max jobs
  duration: 1000 // Per second
}
```

### Retry Policy
Edit `src/config/queue.js`:
```javascript
attempts: 3,  // Number of retries
backoff: {
  type: "exponential",
  delay: 5000  // Starting delay (ms)
}
```

---

## Testing

### 1. Start Redis
```bash
redis-server
# OR
docker run -d -p 6379:6379 redis:latest
```

### 2. Test Connection
```bash
redis-cli ping
# Should return: PONG
```

### 3. Start Server
```bash
npm run dev
```

### 4. Trigger Manual Evaluation (Testing)
```javascript
const cronManager = require('./src/config/cron');
await cronManager.triggerDailyEvaluation();
```

### 5. Monitor Logs
Watch for:
- "Successfully queued X challenge evaluation jobs"
- "Processing job X of type: challenge-evaluation"
- "Processing job Y of type: member-evaluation"
- "Job completed successfully"

---

## Troubleshooting

### Redis Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solution**: Ensure Redis is running
```bash
redis-server
```

### Jobs Not Processing
**Check**:
1. Is Redis running? (`redis-cli ping`)
2. Is worker initialized? (Check server logs)
3. Are jobs in queue? (Monitor queue stats)

### High Memory Usage
**Solution**: Adjust job retention:
```javascript
removeOnComplete: {
  age: 3600,  // 1 hour instead of 24
  count: 100   // Keep fewer jobs
}
```

---

## Migration from Legacy System

The old synchronous evaluation system (`runDailyEvaluation()`) is still available but **deprecated**.

**To use legacy system**:
```javascript
// In src/config/cron.js
await evaluationService.runDailyEvaluation(); // Old
```

**To use new queue system** (current):
```javascript
// In src/config/cron.js
await evaluationService.runDailyEvaluationWithQueue(); // New
```

---

## Performance Comparison

### Synchronous (Old)
- **50 members**: ~50 seconds (1 second per member)
- **100 members**: ~100 seconds
- **Blocks server**: Yes

### Queue-based (New)
- **50 members**: ~5-10 seconds (10 concurrent workers)
- **100 members**: ~10-20 seconds
- **Blocks server**: No

---

## Files Modified

1. ✅ `src/config/env.js` - Added Redis configuration
2. ✅ `src/config/queue.js` - NEW - Queue setup
3. ✅ `src/workers/evaluation.worker.js` - NEW - Job processor
4. ✅ `src/services/evaluation.service.js` - Added queue-based function
5. ✅ `src/config/cron.js` - Updated to use queue
6. ✅ `src/server.js` - Initialize worker
7. ✅ `.env.example` - Added Redis variables
8. ✅ `package.json` - Added bullmq, ioredis

---

## Next Steps

1. ✅ Install and start Redis
2. ✅ Update your `.env` with Redis configuration
3. ✅ Test the system with a manual evaluation trigger
4. ✅ Monitor logs during the next scheduled evaluation (1 AM)

---

**Questions?** Check the code comments in:
- `src/config/queue.js`
- `src/workers/evaluation.worker.js`
- `src/services/evaluation.service.js`
