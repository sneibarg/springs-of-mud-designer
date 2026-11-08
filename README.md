# Springs of Mud Designer

Angular front-end for designing Springs of Mud game features.

This repository is an Angular + TypeScript application aimed at the Java persistence API in `som-server-modulith` and the Python game server concepts in `springs-of-mud-server`.

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

Angular defaults live in `src/environments`. Development builds use `src/environments/environment.development.ts`, which points to `http://dragon:9080` and forces API calls through the Angular dev-server proxy in `proxy.conf.json`. Production builds use `src/environments/environment.ts`.

Runtime overrides are stored in browser `localStorage` from the in-app Settings page. In development, stale browser settings cannot force direct cross-origin calls to `http://dragon:9080`; requests use same-origin `/api` and the dev-server proxy forwards them. Game data is read from `/api/v1/game`.

Database connection settings do not belong in the Angular app because Angular runs in the browser. Configure database host, database name, user, and password in the Java API/backend process instead.

Use the in-app Settings page to point the designer at another API server.

## Verification

```bash
npm run build
npm run lint
```
