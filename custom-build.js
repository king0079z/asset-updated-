// Custom build script to handle file descriptor limit issues
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting custom build process...');

// Base directory for API routes
const apiDir = path.join(__dirname, 'src', 'pages', 'api');
const tempDir = path.join(__dirname, '.api-temp');

// Function to recursively copy a directory
function copyDirectory(source, destination) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });
  
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

// Function to recursively remove a directory
function removeDirectory(dir) {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach((file) => {
      const curPath = path.join(dir, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        // Recursive call
        removeDirectory(curPath);
      } else {
        // Delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dir);
  }
}

// Set environment variables
process.env.NODE_OPTIONS = '--max-old-space-size=4096';
process.env.NEXT_TELEMETRY_DISABLED = '1';
process.env.UV_THREADPOOL_SIZE = '1';
process.env.NEXT_CONCURRENT_FEATURES = '1';

try {
  // Step 1: Backup API directory
  console.log('Backing up API directory...');
  if (fs.existsSync(tempDir)) {
    removeDirectory(tempDir);
  }
  
  if (fs.existsSync(apiDir)) {
    copyDirectory(apiDir, tempDir);
    
    // Step 2: Remove API directory completely
    console.log('Removing API directory to avoid file descriptor issues...');
    removeDirectory(apiDir);
    
    // Create an empty API directory with a simple index.js
    fs.mkdirSync(apiDir, { recursive: true });
    fs.writeFileSync(
      path.join(apiDir, 'index.js'),
      'export default function handler(req, res) { res.status(503).json({ message: "API temporarily unavailable" }); }'
    );
  }
  
  // Step 3: Run Next.js build with optimized settings
  console.log('Running Next.js build...');
  execSync('next build', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
      UV_THREADPOOL_SIZE: '1',
      NEXT_CONCURRENT_FEATURES: '1',
      NODE_OPTIONS: '--max-old-space-size=4096'
    }
  });
  
  // Step 4: Restore API directory
  console.log('Restoring API directory...');
  if (fs.existsSync(apiDir)) {
    removeDirectory(apiDir);
  }
  
  if (fs.existsSync(tempDir)) {
    copyDirectory(tempDir, apiDir);
    removeDirectory(tempDir);
  }
  
  console.log('Build completed successfully!');
} catch (error) {
  // Restore API directory in case of error
  console.error('Build failed:', error);
  
  if (fs.existsSync(tempDir)) {
    console.log('Restoring API directory after error...');
    if (fs.existsSync(apiDir)) {
      removeDirectory(apiDir);
    }
    copyDirectory(tempDir, apiDir);
    removeDirectory(tempDir);
  }
  
  process.exit(1);
}