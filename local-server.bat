@echo off
echo Installing required packages...
call npm install -g tsx
call npm install

echo Starting server...
set NODE_ENV=development
set USE_LOCALHOST=true
npx tsx server/index.ts