# 🎯 ONE COMMAND TO FIX EVERYTHING

## Run This Single Command

```bash
./update-github.sh
```

## Then Set Environment Variable in Render

Go to Render Dashboard → Your Service → Settings → Environment Variables

Add:
- **Key:** `DATABASE_URL`
- **Value:** `postgresql://neondb_owner:npg_jbypqi8SLvJ4@ep-billowing-water-a1dbc0af-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`

## What This Fixes

✅ **Database Connection:** Render will connect to your real Neon PostgreSQL  
✅ **Authentication:** Login will work with admin/admin123  
✅ **Frontend:** Static files will load properly  
✅ **Data Persistence:** All audit data will be saved permanently  

**Your ThorEye audit system will be fully operational after this!**