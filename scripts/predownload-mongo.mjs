// Downloads (and caches) the mongod binary once, serially, before jest spawns
// its parallel workers. On a cold CI cache, many workers calling
// MongoMemoryServer.create() at the same time race on the binary download lock
// and fail with UnableToUnlockLockfileError + hook timeouts. Running this first
// makes the binary already present, so every worker reuses it without racing.

import { MongoMemoryServer } from 'mongodb-memory-server';

const server = await MongoMemoryServer.create();
await server.stop();
console.log('mongod binary ready');
