# Postman Collection & Environment

This directory contains Postman files for testing the CodeDuel backend API.

## Files

### 📋 `Postman_Collection.json`
The main API collection containing all endpoints grouped by feature:
- Health checks
- Authentication (login/register)
- Challenge management
- Dashboard analytics
- LeetCode integration

**Import this file into Postman to get started.**

### 🔧 `postman_environment.json`
Environment configuration file with pre-set variables:
- Base URL: `http://localhost:3000`
- JWT token storage
- Challenge and user ID variables
- API timeout and content-type settings

**Optional but recommended for development.**

## Quick Start

1. **Open Postman** (download from https://www.postman.com/downloads/)

2. **Import the Collection**
   - Click "Import" button
   - Select `Postman_Collection.json`
   - The collection appears in the left sidebar

3. **Import the Environment** (optional)
   - Click "Import" button
   - Select `postman_environment.json`
   - Select it from the environment dropdown (top-right)

4. **Seed the Database**
   - Run `npm run seed` from backend root
   - This creates sample users, challenges, and data

5. **Test the API**
   - Start with "🏥 Health Check" → "Server Health"
   - Then "🔐 Authentication" → "Login with Seed User"
   - Explore other endpoints

## Sample Credentials

Use these credentials for testing (created by seed script):

```
Username: johndoe
Email: john.doe@example.com
Password: password123
```

Other available users: janesmith, bobwilson, alicejohnson, charliebrown

## Variable Usage

The collection uses these variables (automatically populated):

| Variable | Purpose | Auto-filled |
|----------|---------|-------------|
| `{{base_url}}` | API server URL | No (default: localhost:3000) |
| `{{jwt_token}}` | Authentication token | Yes (after login) |
| `{{user_id}}` | Current user ID | Yes (after login) |
| `{{challenge_id}}` | Challenge being tested | Yes (after creating challenge) |
| `{{member_id}}` | Challenge membership ID | Yes (after joining challenge) |

## Testing Workflow

```
1. Health Check ✓
   ↓
2. Login → JWT token saved
   ↓
3. Create Challenge → challenge_id saved (optional)
   ↓
4. Join Challenge → member_id saved (optional)
   ↓
5. Dashboard endpoints
   ↓
6. LeetCode endpoints
```
