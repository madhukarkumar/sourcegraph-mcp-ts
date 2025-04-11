require('dotenv').config();

console.log('Environment variables check:');
console.log(`SOURCEGRAPH_URL: ${process.env.SOURCEGRAPH_URL || 'NOT SET'}`);
console.log(`SOURCEGRAPH_TOKEN: ${process.env.SOURCEGRAPH_TOKEN ? process.env.SOURCEGRAPH_TOKEN.substring(0, 10) + '...' : 'NOT SET'}`);
console.log(`PORT: ${process.env.PORT || 'NOT SET (default: 3000)'}`);

if (!process.env.SOURCEGRAPH_URL || !process.env.SOURCEGRAPH_TOKEN) {
  console.error('\nERROR: Required environment variables are missing!');
  console.error('Please make sure your .env file exists and contains:');
  console.error('SOURCEGRAPH_URL=https://your-instance.sourcegraph.com');
  console.error('SOURCEGRAPH_TOKEN=your_api_token');
} else {
  console.log('\nAll required environment variables are present.');
}