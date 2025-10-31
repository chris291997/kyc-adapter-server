/**
 * Check Redis for verification events
 * This helps verify if EventPublisher is working
 */

const redis = require('redis');

const client = redis.createClient({
  host: 'localhost',
  port: 6379,
});

console.log('🔍 Checking Redis for verification events...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

client.on('error', (err) => {
  console.error('❌ Redis Error:', err.message);
  console.log('\n💡 Make sure Redis is running: docker-compose up redis');
});

client.on('connect', () => {
  console.log('✅ Connected to Redis');
  console.log('📡 Subscribing to verification-events channel...\n');
  console.log('💡 Now run: node test-webhook.js');
  console.log('💡 Any events will be displayed here\n');
  console.log('Press Ctrl+C to exit\n');
  
  // Subscribe to the verification-events channel
  const subscriber = client.duplicate();
  subscriber.connect();
  
  subscriber.subscribe('verification-events', (message) => {
    try {
      const event = JSON.parse(message);
      console.log('🎉 WebSocket Event Received!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Event: ${event.event}`);
      console.log(`VerificationId: ${event.verificationId}`);
      console.log(`Timestamp: ${event.timestamp}`);
      console.log('\nData:');
      console.log(JSON.stringify(event.data, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (error) {
      console.error('Error parsing event:', error);
      console.log('Raw message:', message);
    }
  });
  
  console.log('⏳ Waiting for events...\n');
});

client.connect();


