const esbuild = require('esbuild');
const path = require('path');

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: [path.resolve(__dirname, '../mcp-server/src/index.ts')],
  bundle: true,
  outfile: path.resolve(__dirname, 'dist/mcp-server.cjs'),
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: false,
  minify: true,
  // Resolve MCP server's own node_modules for dependencies
  nodePaths: [path.resolve(__dirname, '../mcp-server/node_modules')],
  // tsconfig for the MCP server source
  tsconfig: path.resolve(__dirname, '../mcp-server/tsconfig.json'),
};

esbuild.build(buildOptions).then(() => {
  console.log('MCP server bundled → dist/mcp-server.cjs');
}).catch((err) => {
  console.error('MCP server bundle failed:', err);
  process.exit(1);
});
