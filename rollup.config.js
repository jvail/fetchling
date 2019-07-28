export default [
  {
    input: 'index.js',
    output: {
      preferConst: true,
      file: 'dist/fetchling.mjs',
      format: 'esm',
      name: 'fetchling'
    },
    plugins: []
  },
  {
    input: 'index.js',
    output: {
      preferConst: true,
      file: 'dist/fetchling.js',
      format: 'esm',
      name: 'fetchling'
    },
    plugins: []
  }
];
