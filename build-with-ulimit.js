const { execSync } = require('child_process');

try {
  // Increase the file descriptor limit before running the build
  console.log('Setting higher ulimit for file descriptors...');
  
  // Try to set a higher limit for file descriptors
  try {
    execSync('ulimit -n 4096', { stdio: 'inherit' });
  } catch (e) {
    console.warn('Could not increase ulimit, continuing with default settings:', e.message);
  }
  
  // Run the Next.js build with reduced concurrency
  console.log('Running Next.js build with reduced concurrency...');
  execSync('NODE_OPTIONS="--max-old-space-size=4096" next build', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1'
    }
  });
  
  console.log('Build completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}