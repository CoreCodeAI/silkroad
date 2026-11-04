import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: { index: 'src/index.ts' }, outDir: 'lib', format: 'esm', fixedExtension: false, platform: 'node', target: 'es2024',
    dts: true, clean: true,
    // DSH packages are shared with the running harness; the MCP SDK installs beside the bundle.
    deps: { neverBundle: [/^@deepseek-ai\//, /^@modelcontextprotocol\//] },
  },
  {
    // Client bundles load through the host page's ModuleLoader and share its React.
    entry: { client: 'src/client/index.tsx' }, outDir: 'lib', format: 'cjs', platform: 'browser', dts: false, clean: false,
    deps: { neverBundle: ['react', 'react/jsx-runtime', 'react-dom'] },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "@deepseek-ai/dsh-silkroad", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
