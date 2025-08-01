#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Maybe Finance MCP Server Setup\n');

// Check if .env exists
if (!fs.existsSync(path.join(__dirname, '.env'))) {
  console.log('Creating .env file from .env.example...');
  fs.copyFileSync(
    path.join(__dirname, '.env.example'),
    path.join(__dirname, '.env')
  );
  console.log('✅ Created .env file');
  console.log('\n⚠️  Please edit .env and add your API credentials:');
  console.log('   - API_BASE_URL: Your Maybe Finance API endpoint');
  console.log('   - API_KEY: Your API key from Maybe Finance\n');
} else {
  console.log('✅ .env file already exists');
}

// Generate Claude Desktop config
const homeDir = process.env.HOME || process.env.USERPROFILE;
const claudeConfigPath = path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');

console.log('\n📋 Add this to your Claude Desktop config:');
console.log(`   Location: ${claudeConfigPath}\n`);

const config = {
  mcpServers: {
    "maybe-finance": {
      command: "node",
      args: [path.join(__dirname, 'dist', 'index.js').replace(/\\/g, '\\\\')],
      env: {
        API_BASE_URL: "https://maybe.lapushinskii.com/api/v1",
        API_KEY: "your-api-key-here"
      }
    }
  }
};

console.log(JSON.stringify(config, null, 2));

console.log('\n📦 Next steps:');
console.log('1. Run "npm install" to install dependencies');
console.log('2. Run "npm run build" to build the project');
console.log('3. Edit .env with your API credentials');
console.log('4. Add the configuration above to Claude Desktop');
console.log('5. Restart Claude Desktop');
console.log('\nThen you can ask Claude about your finances! 💰');