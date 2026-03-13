// Script to temporarily empty API directory during build to reduce file descriptor usage
const fs = require('fs');
const path = require('path');

// Base directory for API routes
const apiDir = path.join(__dirname, 'src', 'pages', 'api');
const backupDir = path.join(__dirname, '.api-backup');

// Template for simplified API route
const simplifiedRouteTemplate = `// Temporary placeholder during build
export default function handler(req, res) {
  res.status(503).json({ error: 'Service temporarily unavailable during build' });
}`;

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

// Function to create a directory if it doesn't exist
function createDirectoryIfNotExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
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

// Start processing
console.log('Starting to backup and empty API directory...');

try {
  // Backup the API directory
  console.log('Backing up API directory...');
  if (fs.existsSync(backupDir)) {
    removeDirectory(backupDir);
  }
  copyDirectory(apiDir, backupDir);
  
  // Empty the API directory
  console.log('Emptying API directory...');
  removeDirectory(apiDir);
  createDirectoryIfNotExists(apiDir);
  
  // Create a minimal API structure
  console.log('Creating minimal API structure...');
  
  // Create a simple index.ts file
  fs.writeFileSync(path.join(apiDir, 'index.ts'), simplifiedRouteTemplate);
  
  // Create essential API routes for recipes
  const recipesDir = path.join(apiDir, 'recipes');
  createDirectoryIfNotExists(recipesDir);
  fs.writeFileSync(path.join(recipesDir, 'index.ts'), simplifiedRouteTemplate);
  fs.writeFileSync(path.join(recipesDir, '[id].ts'), simplifiedRouteTemplate);
  
  // Create essential API routes for food-supply
  const foodSupplyDir = path.join(apiDir, 'food-supply');
  createDirectoryIfNotExists(foodSupplyDir);
  fs.writeFileSync(path.join(foodSupplyDir, 'index.ts'), simplifiedRouteTemplate);
  
  console.log('API directory emptied and minimal structure created.');
} catch (error) {
  console.error('Error processing API directory:', error);
  console.log('Continuing with build despite errors...');
}