#!/bin/bash
# One-command production deploy: this is the single entrypoint a future GitHub webhook/CI
# job should call on the server (see README.md's Production section and
# docs/decisions/0010-prisma-migrations.md).
#
# Migration safety: this script only ever runs `bun run db:migrate:deploy`
# (`prisma migrate deploy`) — never `migrate dev`/`migrate reset`/`db push`. It applies
# already-committed, already-reviewed migration files and never resets/wipes data — see
# docs/decisions/0010-prisma-migrations.md for the full policy.
#
# Adapted from a deploy.sh used on another project (backend/frontend split, pnpm, PM2) —
# this app is a single Next.js monolith on bun, so that split and the seed step don't apply
# here; the PM2 restart-or-start step is kept since production also runs under HestiaCP's
# Node.js app proxy + PM2 (see README.md).

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# PM2 path
PM2=/usr/bin/pm2

# Must match whatever HestiaCP's Node.js app support registered this app as under PM2.
# Override by exporting PM2_APP_NAME before calling this script, or set it in the server's
# .env.
PM2_APP_NAME="${PM2_APP_NAME:-gzavnili-next}"

# Load variables from .env
set -a
source .env
set +a

echo -e "${YELLOW}🚀 Starting deployment...${NC}"

# Step 1: Pull changes
echo -e "${YELLOW}1️⃣  Pulling latest changes...${NC}"
git pull origin main
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to pull changes${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Changes pulled successfully${NC}"

# Step 2: Install dependencies (postinstall also runs `prisma generate`)
echo -e "${YELLOW}2️⃣  Installing dependencies...${NC}"
bun install --frozen-lockfile
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Dependencies installed (Prisma client generated via postinstall)${NC}"

# Step 3: Run database migrations — production-safe, never resets (see file header)
echo -e "${YELLOW}3️⃣  Running database migrations...${NC}"
bun run db:migrate:deploy
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to run migrations${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Migrations completed${NC}"

# Step 4: Build
echo -e "${YELLOW}4️⃣  Building...${NC}"
bun run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to build${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build succeeded${NC}"

# Step 5: Restart app with PM2
echo -e "${YELLOW}5️⃣  Restarting app with PM2...${NC}"
$PM2 restart "$PM2_APP_NAME"
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  PM2 process not found, starting new one...${NC}"
    $PM2 start bun --name "$PM2_APP_NAME" -- run start
    $PM2 save
fi
echo -e "${GREEN}✅ App restarted${NC}"

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
