// Script to simplify all API routes to reduce file dependencies
const fs = require('fs');
const path = require('path');

// Base directory for API routes
const apiDir = path.join(__dirname, 'src', 'pages', 'api');

// Template for simplified API route
const simplifiedRouteTemplate = `// Simplified version to reduce file dependencies
export default function handler(req, res) {
  res.status(503).json({ error: 'Service temporarily unavailable' });
}`;

// Function to recursively process directories
function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Recursively process subdirectories
      processDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
      // Simplify API route file
      console.log(`Simplifying API route: ${fullPath}`);
      fs.writeFileSync(fullPath, simplifiedRouteTemplate);
    }
  }
}

// Start processing from the API directory
console.log('Starting to simplify API routes...');
processDirectory(apiDir);
console.log('Finished simplifying API routes.');