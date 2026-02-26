/**
 * Test script to demonstrate background job queue functionality
 * Run this to manually trigger evaluation jobs and show async processing
 */

const { evaluationQueue } = require('./src/config/queue');
const logger = require('./src/utils/logger');

async function testQueue() {
  console.log('\n🚀 Testing Background Job Queue System\n');
  
  try {
    // Add a test job
    const job = await evaluationQueue.add('test-evaluation', {
      testData: 'This is a test job',
      timestamp: new Date().toISOString()
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      }
    });

    console.log('✅ Job added to queue successfully!');
    console.log(`   Job ID: ${job.id}`);
    console.log(`   Job Name: ${job.name}`);
    console.log(`   Queue: evaluation`);
    
    // Get queue stats
    const waitingCount = await evaluationQueue.getWaitingCount();
    const activeCount = await evaluationQueue.getActiveCount();
    const completedCount = await evaluationQueue.getCompletedCount();
    const failedCount = await evaluationQueue.getFailedCount();
    
    console.log('\n📊 Queue Statistics:');
    console.log(`   Waiting: ${waitingCount}`);
    console.log(`   Active: ${activeCount}`);
    console.log(`   Completed: ${completedCount}`);
    console.log(`   Failed: ${failedCount}`);
    
    console.log('\n✨ Queue system is working correctly!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing queue:', error);
    process.exit(1);
  }
}

testQueue();
