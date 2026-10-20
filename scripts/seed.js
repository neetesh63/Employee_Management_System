/**
 * PeopleDesk Pro — Database Seed Script
 * Run: npm run seed
 * Run (clean wipe first): npm run seed:clean
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { seedDatabase } = require('../src/utils/seedData');
const connectDB = require('../src/config/db');

const CLEAN = process.argv.includes('--clean');

async function run() {
  const { uri } = await connectDB();
  console.log(`\n🌱  Seeding database at: ${uri}`);
  
  const stats = await seedDatabase({ clean: CLEAN });

  console.log('\n═══════════════════════════════════════');
  console.log('🎉  Seed complete!');
  console.log(`   Employees:   ${stats.ec}`);
  console.log(`   Departments: ${stats.dc}`);
  console.log(`   Users:       ${stats.uc}`);
  console.log(`   Leaves:      ${stats.lc}`);
  console.log('\n🔑  Demo Credentials:');
  console.log(`   Admin:       ${process.env.SEED_ADMIN_EMAIL || 'admin@peopledesk.com'} / ${process.env.SEED_ADMIN_PASSWORD || 'Admin@123!'}`);
  console.log('   HR Manager:  meera.singh@example.com / HRManager@123!');
  console.log('   Employee:    aarav.sharma@example.com / Employee@123!');
  console.log('═══════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
