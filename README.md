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

The designer defaults to `http://localhost:9080`. The Settings section can change the API server at runtime. During local development, the Vite/Node dev server serializes those settings to `.designer/settings.json`, which is intentionally ignored by git.

The Vite dev server proxies `/api` to the saved API server from `.designer/settings.json` so browser requests avoid CORS issues during local development. Game data is read from `/api/v1/game`.

```bash
npm run dev
```

Use the in-app Settings page to point the designer at another API server.

## Verification

```bash
npm run build
```
