@echo off
echo Installing dependencies...
call npm install

echo Starting application...
set NODE_ENV=development
set USE_LOCALHOST=true
call npx tsx server/index.ts