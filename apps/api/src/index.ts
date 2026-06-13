import { createServer } from "./server.js";

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "127.0.0.1";
const server = createServer();

server.listen(port, host, () => {
  process.stdout.write(`Open Prior Auth API listening on http://${host}:${port}\n`);
});
