import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

await mkdir(dist, { recursive: true });
await cp(resolve(root, "src", "index.js"), resolve(dist, "index.js"));
await cp(resolve(root, "src", "index.d.ts"), resolve(dist, "index.d.ts"));
await cp(resolve(root, "src", "media-webrtc-adapter.ts"), resolve(dist, "media-webrtc-adapter.ts"));
await cp(resolve(root, "src", "runtime-surface-client.js"), resolve(dist, "runtime-surface-client.js"));
await cp(resolve(root, "src", "surface-app-contract.js"), resolve(dist, "surface-app-contract.js"));
await cp(resolve(root, "src", "surface-app-contract.d.ts"), resolve(dist, "surface-app-contract.d.ts"));
await cp(resolve(root, "src", "service-registry-model.js"), resolve(dist, "service-registry-model.js"));
await cp(resolve(root, "src", "service-registry-model.d.ts"), resolve(dist, "service-registry-model.d.ts"));
await cp(resolve(root, "src", "projection-read-model.js"), resolve(dist, "projection-read-model.js"));
await cp(resolve(root, "src", "projection-read-model.d.ts"), resolve(dist, "projection-read-model.d.ts"));
await cp(resolve(root, "src", "runtime-stream-session.js"), resolve(dist, "runtime-stream-session.js"));
await cp(resolve(root, "src", "runtime-stream-session.d.ts"), resolve(dist, "runtime-stream-session.d.ts"));
await cp(resolve(root, "src", "styles.css"), resolve(dist, "styles.css"));
