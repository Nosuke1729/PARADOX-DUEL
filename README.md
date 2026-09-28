# PARADOX DUEL

A lightweight 1v1 online action-game prototype.

## Current prototype

- Create or join a room with a short room code
- Two-player presence tracking with Supabase Realtime Presence
- Real-time movement and attack events with Supabase Realtime Broadcast
- Browser-based arena built with TypeScript + Vite

## Local development

```bash
npm install
npm run dev
```

The Supabase publishable key used by the browser is intentionally a client-safe publishable key. Never commit a Supabase secret/service-role key.
