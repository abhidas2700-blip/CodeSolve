# Netlify Database Connection Troubleshooting

## Current Status
- ✅ Local development: Database connected and working
- ❌ Netlify deployment: Not showing database data

## Root Cause
The Netlify deployment is not connecting to your Neon database because the environment variable isn't properly set.

## Solution Steps

### 1. In Netlify Dashboard
1. Go to your Netlify site dashboard
2. Navigate to: **Site Settings** → **Environment Variables**
3. Click **Add Variable**
4. Set:
   - **Key:** `DATABASE_URL`
   - **Value:** `postgresql://neondb_owner:npg_jbypqi8SLvJ4@ep-billowing-water-a1dbc0af-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`

### 2. Redeploy
After setting the environment variable, trigger a new deployment:
- Either push a new commit
- Or go to **Deploys** → **Trigger Deploy** → **Deploy Site**

### 3. Verify Connection
Once deployed, test the database connection by visiting:
`https://your-site.netlify.app/api/db-test`

You should see:
```json
{
  "status": "connected",
  "message": "Database connection successful",
  "forms_count": 1
}
```

### 4. Login Test
After database connection is confirmed:
- Username: `admin`
- Password: `admin123`

You should then see your real database data including:
- Forms: "TEST 1234"
- Audit Reports: "AUD-96804054" etc.
- All your existing data

## If Still Not Working
Check the Netlify function logs in the dashboard for any error messages.