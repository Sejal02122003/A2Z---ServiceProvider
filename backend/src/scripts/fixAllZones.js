import '../config/env.js';
import { connectDb } from '../config/db.js';
import mongoose from 'mongoose';

async function run() {
  await connectDb();
  const db = mongoose.connection.db;
  const res = await db.collection('labourservices').updateMany(
    { isAllZones: false },
    { $set: { isAllZones: true } }
  );
  console.log('Updated services with isAllZones:false to true ->', res.modifiedCount);

  const resNull = await db.collection('labourservices').updateMany(
    { isAllZones: { $exists: false } },
    { $set: { isAllZones: true } }
  );
  console.log('Updated services missing isAllZones to true ->', resNull.modifiedCount);

  await mongoose.disconnect();
}

run().catch(console.error);
