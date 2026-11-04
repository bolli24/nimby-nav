# nimby-nav

Journey planner for NIMBY Rails timetables.

- Loads a timetable JSON export from NIMBY Rails (two examples included in `public/`)
- Finds the earliest arrival between two stations from a given departure time (Dijkstra over timed connections)
- Adds walking connections between nearby stations
- Client-side only; Svelte + TypeScript + Vite

```sh
pnpm install
pnpm dev
```

Demo: https://henrikhuth.de/demos/nimby-nav/
