const crypto = require('crypto');
const axios = require('axios');

/**
 * IDMeta Webhook Test Script
 * 
 * IMPORTANT: For the webhook to work, you need a verification record in your database
 * with external_verification_id matching the verification_id in the payload below.
 * 
 * To get a real verification_id:
 *   1. Query: SELECT id, external_verification_id FROM verifications WHERE provider_id = 'cd34f0b8-2c4e-44d0-a20b-1a21273c9a33';
 *   2. Update verification_id in the payload below with an existing external_verification_id
 */

// Provider details
const provider = {
  id: 'cd34f0b8-2c4e-44d0-a20b-1a21273c9a33',
  name: 'IDMeta',
  type: 'multi_step',
  base_url: 'https://integrate.idmetagroup.com/api',
  api_version: 'v1',
  webhook_secret: 'euhudbmwBSDXz4S8ccbCdEaYn+OXBNvgEXwO4gGrftU=',
  webhook_endpoint: '/v1/webhook/idmeta'
};

// Real verification details from your system
const verificationDetails = {
  verificationId: 'cdfd20d9-3a71-4ead-b624-b30994dacaf8', // Internal verification ID
  websocketChannel: 'verification:cdfd20d9-3a71-4ead-b624-b30994dacaf8'
};

// Sample webhook payload (adjust based on IDMeta's actual format)
// ⚠️ IMPORTANT: The verification_id should match the external_verification_id in your database
// Query: SELECT id, external_verification_id FROM verifications WHERE id = '6fb7aa23-1e3b-4963-bf3e-ae284ff1b4d1';
const payload = {
  verification_id: 'YOUR_EXTERNAL_VERIFICATION_ID', // ⚠️ Replace with actual external_verification_id from DB
  status: 'completed',
  result: {
    document_verified: true,
    face_match: true,
    liveness_passed: true
  },
  event: 'verification.completed',
  timestamp: new Date().toISOString(),
  // Include tenant_id if available for better routing
  tenant_id: 'your-tenant-id-here' // Replace with actual tenant ID
};

// Generate HMAC signature
function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

// Generate signature
const signature = generateSignature(payload, provider.webhook_secret);

// Generate curl command
function generateCurlCommand(payload, signature, endpoint) {
  const baseUrl = 'http://localhost:3000';
  const payloadStr = JSON.stringify(payload);
  // Escape single quotes for bash/powershell compatibility
  const escapedPayload = payloadStr.replace(/'/g, "'\\''");
  
  // Windows PowerShell curl
  const powershellCurl = `curl.exe -X POST "${baseUrl}${endpoint}" ` +
    `-H "Content-Type: application/json" ` +
    `-H "x-webhook-signature: ${signature}" ` +
    `-d '${payloadStr}'`;
  
  // Bash/Linux curl
  const bashCurl = `curl -X POST "${baseUrl}${endpoint}" \\\n` +
    `  -H "Content-Type: application/json" \\\n` +
    `  -H "x-webhook-signature: ${signature}" \\\n` +
    `  -d '${escapedPayload}'`;
  
  return { powershellCurl, bashCurl };
}

const { powershellCurl, bashCurl } = generateCurlCommand(payload, signature, provider.webhook_endpoint);

console.log('📋 Webhook Test Details:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Provider: ${provider.name}`);
console.log(`Provider ID: ${provider.id}`);
console.log(`Endpoint: http://localhost:3000${provider.webhook_endpoint}`);
console.log(`Webhook Secret: ${provider.webhook_secret}`);
console.log(`Signature: ${signature}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('🔧 cURL Commands:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n📌 PowerShell (Windows):');
console.log(powershellCurl);
console.log('\n📌 Bash/Linux/Mac:');
console.log(bashCurl);
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Try to fetch verification details from API or database
async function fetchVerificationDetails() {
  // Check if external_verification_id is provided via environment
  if (process.env.EXTERNAL_VERIFICATION_ID) {
    payload.verification_id = process.env.EXTERNAL_VERIFICATION_ID;
    console.log(`✅ Using external_verification_id from environment: ${payload.verification_id}\n`);
    return true;
  }
  
  // Try to fetch from database directly
  try {
    const { Client } = require('pg');
    const client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'kyc_adapter',
      user: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'password'
    });
    
    await client.connect();
    const result = await client.query(
      'SELECT id, external_verification_id, status FROM verifications WHERE id = $1',
      [verificationDetails.verificationId]
    );
    await client.end();
    
    if (result.rows.length > 0) {
      const verification = result.rows[0];
      console.log(`🔍 Found verification in database:`);
      console.log(`   ID: ${verification.id}`);
      console.log(`   External ID: ${verification.external_verification_id || '(null)'}`);
      console.log(`   Status: ${verification.status}\n`);
      
      if (verification.external_verification_id) {
        payload.verification_id = verification.external_verification_id;
        console.log(`✅ Using external_verification_id from database: ${payload.verification_id}\n`);
        return true;
      } else {
        // Auto-set external_verification_id if null
        console.log('⚠️  external_verification_id is null, setting it to internal ID for testing...');
        const updateClient = new Client({
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          database: process.env.DB_NAME || 'kyc_adapter',
          user: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'password'
        });
        await updateClient.connect();
        await updateClient.query(
          'UPDATE verifications SET external_verification_id = $1 WHERE id = $2',
          [verificationDetails.verificationId, verificationDetails.verificationId]
        );
        await updateClient.end();
        
        payload.verification_id = verificationDetails.verificationId;
        console.log(`✅ Set external_verification_id to: ${payload.verification_id}\n`);
        return true;
      }
    }
  } catch (error) {
    console.log(`⚠️  Could not query database: ${error.message}`);
  }
  
  // If still not set, prompt user to provide it
  if (payload.verification_id === 'YOUR_EXTERNAL_VERIFICATION_ID') {
    console.log('⚠️  external_verification_id not found');
    console.log('   Please provide it using one of these methods:');
    console.log('');
    console.log('   Method 1: Query your database:');
    console.log(`     SELECT id, external_verification_id, status FROM verifications WHERE id = '${verificationDetails.verificationId}';`);
    console.log('');
    console.log('   Method 2: Set environment variable:');
    console.log(`     $env:EXTERNAL_VERIFICATION_ID="your-external-id"; node test-webhook.js`);
    console.log('');
    console.log('   Method 3: Update the payload.verification_id in this script');
    console.log('');
    return false;
  }
  
  return true;
}

// Fetch existing verifications for this provider
async function getExistingVerifications() {
  try {
    console.log('💡 To get an existing verification ID, query your database:');
    console.log(`   SELECT id, external_verification_id, status FROM verifications WHERE id = '${verificationDetails.verificationId}';`);
    console.log(`   OR for any verification with this provider:`);
    console.log(`   SELECT id, external_verification_id, status FROM verifications WHERE provider_id = '${provider.id}' LIMIT 5;`);
    console.log('');
  } catch (error) {
    // Ignore errors, just show instructions
  }
}

// Send webhook
async function testWebhook() {
  try {
    // Try to fetch verification details first
    const hasExternalId = await fetchVerificationDetails();
    
    // If we don't have external_verification_id, try using the internal ID as fallback
    if (!hasExternalId && payload.verification_id === 'YOUR_EXTERNAL_VERIFICATION_ID') {
      console.log('⚠️  No external_verification_id found, trying with internal ID as fallback...');
      console.log('   Note: This will likely fail if external_verification_id is required');
      console.log('');
      // Use internal ID as a test - might work if external_verification_id is null or same as internal
      payload.verification_id = verificationDetails.verificationId;
    }
    
    // Regenerate signature with updated payload
    const updatedSignature = generateSignature(payload, provider.webhook_secret);
    
    console.log('🚀 Sending webhook...\n');
    console.log(`📦 Payload verification_id: ${payload.verification_id}`);
    console.log(`🔐 Signature: ${updatedSignature}\n`);
    
    const response = await axios.post(
      `http://localhost:3000${provider.webhook_endpoint}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': updatedSignature
        }
      }
    );

    console.log('✅ Webhook Success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Webhook Failed!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 404 && error.response.data?.message === 'Verification not found') {
        console.log('\n⚠️  Troubleshooting:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('The webhook expects a verification record in the database.');
        console.log(`Current verification_id in payload: "${payload.verification_id}"`);
        console.log('');
        console.log('📝 To fix this:');
        console.log('');
        console.log('  1. Query your database for the external_verification_id:');
        console.log(`     SELECT id, external_verification_id, status FROM verifications WHERE id = '${verificationDetails.verificationId}';`);
        console.log('');
        console.log('  2. Update verification_id in the payload above with the external_verification_id');
        console.log('');
        console.log('  3. Re-run this script to test the webhook');
        console.log('');
        console.log('💡 WebSocket Test:');
        console.log(`     Run: node test-websocket.js`);
        console.log(`     This will listen for updates on: ${verificationDetails.websocketChannel}`);
        console.log('');
        await getExistingVerifications();
      }
    } else {
      console.error('Error:', error.message);
    }
  }
}

testWebhook();

