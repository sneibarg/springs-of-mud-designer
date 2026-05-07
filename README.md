# Springs of Mud Designer

React front-end for designing Springs of Mud game features.

This repository starts with a Vite + React + TypeScript application aimed at the Java persistence API in `som-server-modulith` and the Python game server concepts in `springs-of-mud-server`.

## Feature Areas

- Skills and spells
- Skill and spell game settings
- Areas, rooms, mobiles, items, shops, resets, and specials
- Player communication through socials, commands, and help content

## Development

```bash
npm install
npm run dev
```

The designer defaults to `http://dragon:9080`, matching the current Java backend environment. The Settings section in the app can change the API server at runtime and persists the value in browser storage.

The Vite dev server proxies `/api` to `http://dragon:9080` so browser requests avoid CORS issues during local development. Game data is read from `/api/v1/game`. Set `VITE_SOM_API_BASE_URL` when you want a different build-time default.

```bash
npm run dev
```

PowerShell example with an explicit API URL:

```powershell
$env:VITE_SOM_API_BASE_URL = "http://localhost:8080"
npm run dev
```

## Verification

```bash
npm run build
```
