/**
 * Helper script to set external_verification_id for testing
 * This helps test webhooks when external_verification_id is missing
 */

const { Client } = require('pg');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'kyc_adapter',
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password'
};

// Use verification ID from command line or default
const verificationId = process.argv[2] || '714f80de-c36b-413c-a51b-619c53e76196';
const externalVerificationId = verificationId; // Use internal ID as external for testing

async function setExternalVerificationId() {
  const client = new Client(config);
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Check if verification exists
    const checkResult = await client.query(
      'SELECT id, external_verification_id, status FROM verifications WHERE id = $1',
      [verificationId]
    );
    
    if (checkResult.rows.length === 0) {
      console.log(`❌ Verification ${verificationId} not found in database`);
      console.log('   Please ensure the verification exists first\n');
      return;
    }
    
    const verification = checkResult.rows[0];
    console.log('📋 Current verification:');
    console.log(`   ID: ${verification.id}`);
    console.log(`   External ID: ${verification.external_verification_id || '(null)'}`);
    console.log(`   Status: ${verification.status}\n`);
    
    // Update external_verification_id
    await client.query(
      'UPDATE verifications SET external_verification_id = $1 WHERE id = $2',
      [externalVerificationId, verificationId]
    );
    
    console.log(`✅ Updated external_verification_id to: ${externalVerificationId}\n`);
    console.log('💡 You can now run: node test-webhook.js\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('relation "verifications" does not exist')) {
      console.log('\n⚠️  Database tables not found. Make sure migrations have been run.');
      console.log('   Run: npm run migration:run\n');
    }
  } finally {
    await client.end();
  }
}

setExternalVerificationId();

