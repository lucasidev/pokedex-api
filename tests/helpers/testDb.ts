import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer | undefined;

export async function startInMemoryMongo(): Promise<string> {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  return uri;
}

export async function stopInMemoryMongo(): Promise<void> {
  await mongoose.disconnect();
  await mongoServer?.stop();
  mongoServer = undefined;
}

export async function clearDatabase(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }
}
