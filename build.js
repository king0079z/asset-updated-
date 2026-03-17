// Custom build script to handle file limit issues
const { execSync } = require('child_process');
const os = require('os');

// Increase memory limit for Node.js
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

// Run the build command with increased file descriptor limit on Unix-like systems
try {
  if (os.platform() !== 'win32') {
    console.log('Running build with increased file descriptor limit...');
    execSync('ulimit -n 10240 && next build', { stdio: 'inherit' });
  } else {
    // On Windows, just run the normal build
    console.log('Running normal build on Windows...');
    execSync('next build', { stdio: 'inherit' });
  }
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}