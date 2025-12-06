const esbuild = require('esbuild');
const path = require('path');

const isWatch = process.argv.includes('--watch');

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
  minify: false
};

async function build() {
  try {
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


