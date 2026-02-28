# LeetCode Challenge Tracker - Automated Setup Script
# This script automates the initial setup process

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LeetCode Challenge Tracker Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js installation
Write-Host "[1/7] Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check npm installation
Write-Host ""
Write-Host "[2/7] Checking npm installation..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "✓ npm found: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm not found. Please install npm." -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host ""
Write-Host "[3/7] Installing dependencies..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Gray
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Create .env file if it doesn't exist
Write-Host ""
Write-Host "[4/7] Setting up environment file..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "⚠ .env file already exists. Skipping..." -ForegroundColor Yellow
} else {
    Copy-Item ".env.example" ".env"
    Write-Host "✓ Created .env file from template" -ForegroundColor Green
}

# Generate secrets
Write-Host ""
Write-Host "[5/7] Generating security secrets..." -ForegroundColor Yellow
$jwtSecret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
$encryptionKey = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

Write-Host "✓ Generated JWT_SECRET" -ForegroundColor Green
Write-Host "✓ Generated ENCRYPTION_KEY" -ForegroundColor Green

# Update .env file with generated secrets
$envContent = Get-Content ".env" -Raw
$envContent = $envContent -replace 'JWT_SECRET=your_jwt_secret_key_here_change_this_in_production', "JWT_SECRET=$jwtSecret"
$envContent = $envContent -replace 'ENCRYPTION_KEY=your_encryption_key_here_change_this_in_production', "ENCRYPTION_KEY=$encryptionKey"
Set-Content ".env" $envContent

Write-Host "✓ Updated .env with generated secrets" -ForegroundColor Green

# Prompt for database URL
Write-Host ""
Write-Host "[6/7] Database configuration" -ForegroundColor Yellow
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  NEON DATABASE SETUP REQUIRED" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Please follow these steps:" -ForegroundColor White
Write-Host "  1. Go to https://neon.tech/" -ForegroundColor White
Write-Host "  2. Sign up or log in" -ForegroundColor White
Write-Host "  3. Create a new project" -ForegroundColor White
Write-Host "  4. Click 'Connect' and select 'Prisma'" -ForegroundColor White
Write-Host "  5. Copy the connection string" -ForegroundColor White
Write-Host ""
Write-Host "The connection string looks like:" -ForegroundColor Gray
Write-Host "postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require" -ForegroundColor Gray
Write-Host ""

$databaseUrl = Read-Host "Paste your Neon DATABASE_URL here (or press Enter to skip)"

if ($databaseUrl) {
    $envContent = Get-Content ".env" -Raw
    $envContent = $envContent -replace 'DATABASE_URL="postgresql://postgres:password@localhost:5432/leetcode_tracker"', "DATABASE_URL=`"$databaseUrl`""
    Set-Content ".env" $envContent
    Write-Host "✓ Database URL updated" -ForegroundColor Green
    
    # Try to connect and migrate
    Write-Host ""
    Write-Host "[7/7] Setting up database schema..." -ForegroundColor Yellow
    Write-Host "Generating Prisma Client..." -ForegroundColor Gray
    npm run prisma:generate
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Prisma Client generated" -ForegroundColor Green
        Write-Host ""
        Write-Host "Running database migrations..." -ForegroundColor Gray
        $env:DATABASE_URL = $databaseUrl
        npx prisma migrate dev --name init
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Database schema created successfully" -ForegroundColor Green
        } else {
            Write-Host "⚠ Migration failed. You may need to run 'npm run prisma:migrate' manually" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "⚠ Skipped database setup. You need to:" -ForegroundColor Yellow
    Write-Host "  1. Update DATABASE_URL in .env file" -ForegroundColor Yellow
    Write-Host "  2. Run: npm run prisma:generate" -ForegroundColor Yellow
    Write-Host "  3. Run: npm run prisma:migrate" -ForegroundColor Yellow
}

# Final summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Review and update .env file if needed" -ForegroundColor White
Write-Host "  2. Run 'npm run dev' to start the development server" -ForegroundColor White
Write-Host "  3. Test the API at http://localhost:3000/health" -ForegroundColor White
Write-Host ""
Write-Host "Documentation:" -ForegroundColor White
Write-Host "  - Quick Start: QUICK_START.md" -ForegroundColor White
Write-Host "  - Full Guide: SETUP_GUIDE.md" -ForegroundColor White
Write-Host "  - API Docs: README.md" -ForegroundColor White
Write-Host ""
Write-Host "Happy coding! 🚀" -ForegroundColor Cyan
