const esbuild = require('esbuild');
const path = require('path');

// Load environment variables from .env
require('dotenv').config();

const isWatch = process.argv.includes('--watch');

// Get API URL from environment or use default
const API_URL = process.env.API_URL || 'http://localhost:3000';

const buildOptions = {
  entryPoints: [
    'extension/src/background.ts',
    'extension/src/contentScript.ts',
    'extension/src/popup.ts'
  ],
  bundle: true,
  outdir: 'extension/dist',
  format: 'iife',
  target: 'chrome90',
  sourcemap: true,
  minify: false,
  // Inject environment variables at build time
  define: {
    'process.env.API_URL': JSON.stringify(API_URL),
  },
};

async function build() {
  try {
    console.log(`Building extension with API_URL: ${API_URL}`);
    
    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('Watching for changes...');
    } else {
      await esbuild.build(buildOptions);
      console.log('Extension built successfully!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
