# Cold Start Cron Configuration

## Problem
Render free tier sleeps after 15 minutes of inactivity. First request after sleep takes 30-60s (cold start).

## Solution
External cron pinger hits `/health` every 14 minutes to keep the service alive.

## Setup (cron-job.org)

1. Go to [cron-job.org](https://cron-job.org) and create a free account
2. Create a new cron job:
   - **URL**: `https://wings-nails-api.onrender.com/health`
   - **Schedule**: Every 14 minutes
   - **Request method**: GET
   - **Save response**: No
3. Enable the cron job

## Why 14 minutes?
Render's sleep threshold is 15 minutes. Pinging at 14 minutes ensures the service never reaches the idle timeout.

## Health endpoint
```
GET /health
Response: {"status": "ok", "version": "0.1.0"}
```

## Monitoring
- Check cron-job.org dashboard for execution history
- If pings fail, Render service may be down — check Render dashboard
