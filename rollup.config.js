import typescript from '@rollup/plugin-typescript';

const sharedPlugins = [
  typescript({
    tsconfig: './tsconfig.build.json',
    declaration: false,
    declarationMap: false,
    sourceMap: true,
  }),
];

/** @type {import('rollup').RollupOptions[]} */
export default [
  // Main package entries — one self-contained file each (no code-splitting).
  {
    input: 'src/index.ts',
    plugins: sharedPlugins,
    output: [
      { file: 'dist/index.js', format: 'es', sourcemap: true },
      { file: 'dist/index.cjs', format: 'cjs', sourcemap: true, exports: 'named' },
    ],
  },
  {
    input: 'src/protocol/index.ts',
    plugins: sharedPlugins,
    output: [
      { file: 'dist/protocol/index.js', format: 'es', sourcemap: true },
      { file: 'dist/protocol/index.cjs', format: 'cjs', sourcemap: true, exports: 'named' },
    ],
  },
  {
    input: 'src/browser.ts',
    plugins: sharedPlugins,
    output: [
      { file: 'dist/browser.js', format: 'es', sourcemap: true },
      { file: 'dist/browser.cjs', format: 'cjs', sourcemap: true, exports: 'named' },
      {
        file: 'dist/stash-wallet-sdk.umd.js',
        format: 'umd',
        name: 'StashWalletSDK',
        sourcemap: true,
        exports: 'named',
      },
    ],
  },
];
