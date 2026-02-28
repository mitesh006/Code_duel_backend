# Database Seeding & API Testing Guide

This document explains how to use the database seed script and Postman collection to set up sample data and test the CodeDuel backend APIs.

## 📦 Database Seeding

### Overview

The seed script (`prisma/seed.js`) populates the database with realistic sample data, including:
- **5 Sample Users** with different roles and activity levels
- **10 LeetCode Problems** with realistic metadata (difficulties, acceptance rates, tags)
- **5 Challenges** with various configurations:
  - Easy challenges for beginners
  - Medium/Hard challenges for advanced users
  - Public and private challenges
  - Different penalty structures
- **Challenge Memberships** - Users joined to challenges with realistic stats
- **Daily Results** - 7 days of activity per member with completion data
- **Penalty Ledger** - Sample penalty records for inactive members

### Running the Seed

#### Option 1: Using npm script (recommended)
```bash
npm run seed
```

#### Option 2: Using Prisma CLI
```bash
npx prisma db seed
```

#### Option 3: Direct execution
```bash
node prisma/seed.js
```

### Sample Users (for testing)

After running the seed, you can login with these credentials:

| Username | Email | Password | LeetCode Username |
|----------|-------|----------|------------------|
| johndoe | john.doe@example.com | password123 | john_doe |
| janesmith | jane.smith@example.com | password123 | jane_smith |
| bobwilson | bob.wilson@example.com | password123 | bob_wilson |
| alicejohnson | alice.johnson@example.com | password123 | alice_johnson |
| charliebrown | charlie.brown@example.com | password123 | charlie_brown |

## 🔧 Postman Collection

### Setup

1. **Import the Collection**
   - Open Postman
   - Click "Import" → Select `Postman_Collection.json`
   - The collection will include all API endpoints and sample requests

2. **Import the Environment (Optional)**
   - Click "Import" → Select `postman_environment.json`
   - This provides pre-configured variables for local testing

3. **Configure Variables**
   - The collection uses these variables:
     - `{{base_url}}` - Server URL (default: `http://localhost:3000`)
     - `{{jwt_token}}` - JWT token (auto-populated after login)
     - `{{challenge_id}}` - Challenge ID (auto-populated after creating challenge)
     - `{{member_id}}` - Member ID (auto-populated after joining challenge)
     - `{{user_id}}` - User ID (auto-populated after login)

### Testing Workflow

#### Step 1: Health Check
```
GET /health
```
No authentication required. Verify the server is running.

#### Step 2: Authentication
Either **Register** a new user or **Login** with seed credentials:

**Login with existing user (recommended):**
```
POST /api/auth/login
{
  "emailOrUsername": "johndoe",
  "password": "password123"
}
```

The JWT token will be automatically saved to `{{jwt_token}}` variable.

#### Step 3: Create a Challenge (Optional)
```
POST /api/challenges
```
Create a new challenge with your preferred settings.

#### Step 4: Get All Challenges
```
GET /api/challenges
```
List all challenges you own or are a member of.

#### Step 5: Join a Challenge
```
POST /api/challenges/{{challenge_id}}/join
```
Join an existing public challenge.

#### Step 6: View Dashboard
```
GET /api/dashboard
```
View your overall dashboard with stats and active challenges.

#### Step 7: Dashboard Details
```
GET /api/dashboard/challenge/{{challenge_id}}
GET /api/dashboard/challenge/{{challenge_id}}/leaderboard
GET /api/dashboard/activity-heatmap
GET /api/dashboard/stats
GET /api/dashboard/submission-chart
```
Explore various dashboard views and analytics.

#### Step 8: LeetCode Integration
```
GET /api/leetcode/profile/{username}
GET /api/leetcode/problem/{titleSlug}
```
Test LeetCode integration endpoints.

### Collection Organization

The collection is organized into 5 folders:

1. **🏥 Health Check**
   - Server Health
   - API Root

2. **🔐 Authentication**
   - Register New User
   - Login with Seed User
   - Get Current Profile
   - Update Profile (LeetCode Username)
   - Update Profile (Password)

3. **🎯 Challenges**
   - Create New Challenge
   - Get All User Challenges
   - Get Challenge by ID
   - Join Challenge
   - Update Challenge Status (ACTIVE/COMPLETED)

4. **📊 Dashboard**
   - Get Dashboard Overview
   - Get Today's Status
   - Get Challenge Progress
   - Get Challenge Leaderboard
   - Get Activity Heatmap
   - Get User Stats
   - Get Submission Chart

5. **💻 LeetCode Integration**
   - Get LeetCode User Profile
   - Test LeetCode Connection
   - Get Problem Metadata (Multiple problems)
