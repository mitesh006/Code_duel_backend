# 🚀 Complete Setup Guide - LeetCode Daily Challenge Tracker

This guide will walk you through setting up the backend from scratch, including Neon PostgreSQL database configuration.

---

## 📋 Prerequisites

Before starting, ensure you have:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** (optional, for version control)

Check your Node.js version:

```powershell
node --version
npm --version
```

---

## 🗄️ Step 1: Create Neon PostgreSQL Database

Neon is a serverless PostgreSQL platform. Follow these steps:

### 1.1 Sign up for Neon

1. Go to [Neon](https://neon.tech/)
2. Click **"Sign Up"** (you can use GitHub, Google, or email)
3. Complete the registration process

### 1.2 Create a New Project

1. Once logged in, click **"Create a project"**
2. Choose a name (e.g., "leetcode-challenge-tracker")
3. Select your region (choose closest to your location)
4. Select PostgreSQL version (use default, usually v15 or v16)
5. Click **"Create project"**

### 1.3 Get Your Database Connection String

1. After project creation, you'll see the dashboard
2. Click on **"Connection string"** or **"Connect"**
3. Select **"Prisma"** from the connection type dropdown
4. Copy the connection string - it looks like:
   ```
   postgresql://username:password@ep-xxxx-xxxx.region.aws.neon.tech/neondb?sslmode=require
   ```
5. **SAVE THIS CONNECTION STRING** - you'll need it in Step 3

> 💡 **Tip**: The connection string contains your password. Keep it secure!

---

## 🔑 Step 2: Generate Encryption Keys

You need to generate secure random keys for JWT and encryption.

Open PowerShell in your project directory and run:

```powershell
# Generate JWT Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Copy the output** (it will be a long string like `a1b2c3d4...`). This is your JWT_SECRET.

Run the command again to generate another key:

```powershell
# Generate Encryption Key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Copy this output too**. This is your ENCRYPTION_KEY.

---

## ⚙️ Step 3: Configure Environment Variables

### 3.1 Create .env file

In your project root directory (`d:\Code_duel_backend`), create a new file named `.env`:

```powershell
# Copy the example file
Copy-Item .env.example .env
```

Or manually create a new file named `.env`

### 3.2 Edit the .env file

Open the `.env` file and update the following values:

```env
# Environment Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
# Replace with your Neon PostgreSQL connection string from Step 1.3
DATABASE_URL="postgresql://username:password@ep-xxxx-xxxx.region.aws.neon.tech/neondb?sslmode=require"

# JWT Configuration
# Replace with the first key generated in Step 2
JWT_SECRET=paste_your_generated_jwt_secret_here
JWT_EXPIRES_IN=7d

# Encryption Configuration
# Replace with the second key generated in Step 2
ENCRYPTION_KEY=paste_your_generated_encryption_key_here

# LeetCode API Configuration
LEETCODE_GRAPHQL_URL=https://leetcode.com/graphql

# Cron Configuration
CRON_ENABLED=true
# For testing, use every 15 minutes: */15 * * * *
# For production, use daily at 1 AM: 0 1 * * *
DAILY_EVALUATION_TIME=0 1 * * *

# CORS Configuration
# Use '*' for development
CORS_ORIGIN=*

# Email Configuration (Optional - can be configured later)
EMAIL_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM="Code Duel <noreply@codeduel.com>"

# Email Reminder Cron Configuration
DAILY_REMINDER_TIME=0 18 * * *
WEEKLY_SUMMARY_TIME=0 10 * * 0
```

**Important**:

- Replace `DATABASE_URL` with your Neon connection string
- Replace `JWT_SECRET` with your generated key
- Replace `ENCRYPTION_KEY` with your generated key
- You can leave email settings as-is for now (EMAIL_ENABLED=false)

---

## 📦 Step 4: Install Dependencies

Open PowerShell in your project directory and run:

```powershell
# Navigate to project directory
cd "d:\Code_duel_backend"

# Install all dependencies
npm install
```

This will install all required packages including Prisma, Express, and others.

**Wait for installation to complete** (may take 2-5 minutes).

---

## 🗃️ Step 5: Set Up Prisma and Database

### 5.1 Generate Prisma Client

```powershell
npm run prisma:generate
```

This generates the Prisma Client based on your schema.

### 5.2 Run Database Migrations

This creates all the tables in your Neon database:

```powershell
npm run prisma:migrate
```

When prompted for a migration name, enter something like:

```
initial_setup
```

**Expected output**: You should see messages about creating tables (users, challenges, challenge_members, etc.)

### 5.3 Verify Database Setup (Optional)

Open Prisma Studio to view your database:

```powershell
npm run prisma:studio
```

This opens a web interface at `http://localhost:5555` where you can see all your tables.
Press `Ctrl+C` to stop Prisma Studio when done.

---

## 🎯 Step 6: Run the Application

### Development Mode (with auto-reload)

```powershell
npm run dev
```

### Production Mode

```powershell
npm start
```

**Expected output**:

```
🚀 Server is running on port 3000
✅ Database connected successfully
⏰ Cron jobs initialized
```

---

## ✅ Step 7: Test the Server

### Option 1: Browser Test

Open your browser and go to:

```
http://localhost:3000/health
```

You should see:

```json
{
  "status": "ok",
  "timestamp": "2026-02-26T..."
}
```

### Option 2: PowerShell Test

```powershell
Invoke-WebRequest -Uri http://localhost:3000/health -Method GET
```

### Option 3: Use the Postman Collection

Import the `Postman_Collection.json` file in Postman to test all API endpoints.

---

## 🧪 Test the API Endpoints

### 1. Register a User

```powershell
$body = @{
    username = "testuser"
    email = "test@example.com"
    password = "Test@1234"
    leetcodeUsername = "testuser_lc"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/api/auth/register -Method POST -Body $body -ContentType "application/json"
```

### 2. Login

```powershell
$body = @{
    email = "test@example.com"
    password = "Test@1234"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri http://localhost:3000/api/auth/login -Method POST -Body $body -ContentType "application/json"
$response.Content
```

Copy the `token` from the response - you'll need it for authenticated requests.

---

## 🐛 Troubleshooting

### Issue: "Error connecting to database"

**Solution**:

- Verify your `DATABASE_URL` in `.env` is correct
- Check if your Neon database is active (visit Neon dashboard)
- Ensure the connection string includes `?sslmode=require`

### Issue: "Cannot find module '@prisma/client'"

**Solution**:

```powershell
npm run prisma:generate
```

### Issue: "Port 3000 is already in use"

**Solution**:

- Change `PORT` in `.env` to another port (e.g., 5000)
- Or stop the process using port 3000

### Issue: Migrations fail

**Solution**:

- Check your database connection
- Try resetting the database:

```powershell
npx prisma migrate reset
```

### Issue: "Invalid token" errors

**Solution**:

- Ensure `JWT_SECRET` in `.env` is set
- Make sure you're sending the token in Authorization header: `Bearer YOUR_TOKEN`

---

## 📚 Next Steps

1. **Import Postman Collection**: Import `Postman_Collection.json` to test all endpoints
2. **Read API Documentation**: Check the main README.md for endpoint details
3. **Create a Challenge**: Use the `/api/challenges` endpoint to create your first challenge
4. **Configure Email** (Optional): Set up SMTP settings for email notifications
5. **Deploy** (Optional): Deploy to a cloud platform like Render, Railway, or Heroku

---

## 🔒 Security Reminders

✅ **NEVER** commit your `.env` file to Git (it's already in `.gitignore`)  
✅ Use strong, unique values for `JWT_SECRET` and `ENCRYPTION_KEY`  
✅ Change `CORS_ORIGIN` to your frontend URL in production  
✅ Set `NODE_ENV=production` when deploying  
✅ Keep your Neon database credentials secure

---

## 📞 Need Help?

- Check the logs in `logs/` directory
- Review error messages in the console
- Verify all environment variables are set correctly
- Check that your Node.js version is v16+

---

**🎉 Congratulations! Your backend is now ready to use!**
