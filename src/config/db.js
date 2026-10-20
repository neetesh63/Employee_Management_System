const mongoose = require('mongoose');
let mongodInstance = null;

const connectDB = async () => {
  const configuredUri = process.env.MONGODB_URI;
  const targetUri = configuredUri || 'mongodb://localhost:27017/peopledesk';

  let conn = null;
  let activeUri = targetUri;

  // 1. Try connecting to specified / local MongoDB
  try {
    conn = await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: configuredUri ? 5000 : 2000,
      socketTimeoutMS: 45000,
    });
    console.log(`✅  MongoDB connected: ${conn.connection.host}`);
    activeUri = targetUri;
  } catch (err) {
    // If user provided a specific URI that failed, warn them
    if (configuredUri) {
      console.warn(`⚠️  Failed to connect to configured MONGODB_URI: ${err.message}`);
    } else {
      console.log('ℹ️  No local MongoDB service running on port 27017.');
    }

    console.log('🚀  Starting built-in in-memory MongoDB instance for seamless local operation...');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongodInstance = await MongoMemoryServer.create({
        instance: { dbName: 'peopledesk' },
      });
      activeUri = mongodInstance.getUri();
      conn = await mongoose.connect(activeUri);
      console.log(`✅  Connected to built-in MongoDB engine (${activeUri})`);
    } catch (memErr) {
      console.error('❌  Failed to initialize database engine:', memErr.message);
      process.exit(1);
    }
  }

  // 2. Auto-seed if database is empty so the app is instantly usable
  try {
    const User = require('../models/User');
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱  Initial database setup: auto-seeding sample employees and accounts...');
      const { seedDatabase } = require('../utils/seedData');
      await seedDatabase();
      console.log('✅  Sample data auto-seeded successfully!');
    }
  } catch (seedErr) {
    console.warn('⚠️  Auto-seed notice:', seedErr.message);
  }

  // Graceful shutdown
  const cleanup = async () => {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      if (mongodInstance) {
        await mongodInstance.stop();
      }
    } catch (_) {}
    process.exit(0);
  };

  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);

  return { conn, uri: activeUri, mongod: mongodInstance };
};

module.exports = connectDB;
