# ⚡ Quick Start Guide

Follow these steps to get the application running quickly.

## Step 1: Install Dependencies

```powershell
npm install
```

## Step 2: Set Up Neon PostgreSQL Database

### 2.1 Create Neon Account

1. Go to https://neon.tech/
2. Sign up with GitHub, Google, or email
3. Verify your email

### 2.2 Create Database Project

1. Click **"Create a project"**
2. Project name: `leetcode-challenge-tracker`
3. Select region (closest to you)
4. Click **"Create project"**

### 2.3 Get Connection String

1. In the Neon dashboard, click **"Connect"**
2. Select **"Prisma"** from the dropdown
3. Copy the connection string (looks like):
   ```
   postgresql://username:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

## Step 3: Configure Environment Variables

### 3.1 Create .env file

```powershell
copy .env.example .env
```

### 3.2 Generate Secrets

Run these commands to generate secure secrets:

**JWT Secret:**

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Encryption Key:**

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3.3 Edit .env file

Open `.env` and update:

```env
# Paste your Neon connection string
DATABASE_URL="postgresql://username:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Paste the generated JWT secret
JWT_SECRET=<paste_generated_jwt_secret_here>

# Paste the generated encryption key
ENCRYPTION_KEY=<paste_generated_encryption_key_here>

# Keep other settings as default for now
```

## Step 4: Set Up Database with Prisma

### 4.1 Generate Prisma Client

```powershell
npm run prisma:generate
```

### 4.2 Run Database Migrations

```powershell
npm run prisma:migrate
```

When prompted for migration name, type: `init`

## Step 5: Start the Server

### Development Mode (with auto-reload)

```powershell
npm run dev
```

### Production Mode

```powershell
npm start
```

## Step 6: Verify Installation

Open your browser or use curl to test:

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

## 🎉 Success!

Your backend is now running! You can:

- Test API endpoints using the `Postman_Collection.json`
- View database in Prisma Studio: `npm run prisma:studio`
- Check logs in the `logs/` folder

## 📚 Next Steps

1. Import `Postman_Collection.json` into Postman to test APIs
2. Create a user account via POST `/api/auth/register`
3. Create a challenge via POST `/api/challenges`
4. Explore the API documentation in README.md

## 🐛 Troubleshooting

### Error: "Missing required environment variables"

- Make sure you've updated DATABASE_URL, JWT_SECRET, and ENCRYPTION_KEY in .env

### Error: "Can't reach database server"

- Check your Neon database connection string
- Ensure your internet connection is active
- Verify the database exists in Neon dashboard

### Port already in use

- Change PORT in .env to a different number (e.g., 3001)
- Or stop the process using that port

### Prisma migration errors

- Check DATABASE_URL is correct
- Ensure database is accessible
- Try: `npm run prisma:migrate -- --name init`

## 📞 Need Help?

Check the detailed SETUP_GUIDE.md for more information.
