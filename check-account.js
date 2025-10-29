const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'kyc_adapter',
  user: 'postgres',
  password: 'password'
});

async function checkAccount() {
  try {
    await client.connect();
    const result = await client.query(
      'SELECT id, verification_status, last_verification_id, verified_data, name, email, phone FROM accounts WHERE id = $1',
      ['09b6dbcf-3910-469e-b8c2-5a9492f9e575']
    );
    
    if (result.rows.length > 0) {
      console.log('📋 Account Status:');
      console.log(JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log('❌ Account not found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkAccount();

