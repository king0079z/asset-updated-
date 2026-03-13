// Robust build script to handle file descriptor limit issues
const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

console.log('Starting robust build process...');

// Increase memory limit for Node.js
process.env.NODE_OPTIONS = '--max-old-space-size=4096';
process.env.NEXT_TELEMETRY_DISABLED = '1';

try {
  // First, run the script to empty API directory
  console.log('Emptying API directory to reduce file dependencies...');
  execSync('node empty-api-dir.js', { stdio: 'inherit' });
  
  // Set environment variables to reduce memory usage and file descriptor usage
  const env = {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: '1',
    UV_THREADPOOL_SIZE: '1',
    NEXT_CONCURRENT_FEATURES: '1', // Reduce concurrency
    NODE_OPTIONS: '--max-old-space-size=4096'
  };
  
  // Run the build command with optimized settings
  console.log('Running build with optimized settings...');
  execSync('next build', { 
    stdio: 'inherit',
    env
  });
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}