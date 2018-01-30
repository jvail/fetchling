// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
import acornAsyncIteration from 'acorn-async-iteration/inject';

export default {
  input: 'index.js',
  preferConst: true,
  output: {
    file: 'dist/fetchling.js',
    format: 'iife',
    name: 'fetchling'
  },
  acorn: {
    ecmaVersion: 9,
    plugins: { asyncIteration: true }
  },
  acornInjectPlugins: [
      acornAsyncIteration
  ],
  plugins: [
    resolve({
      module: true,
      jsnext: false,
      main: true,
      browser: false,
      extensions: [ '.js' ],
      preferBuiltins: false,
      jail: '/',
      modulesOnly: false,
      customResolveOptions: {
        moduleDirectory: 'js_modules'
      }
    })
  ]
};
