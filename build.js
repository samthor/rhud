#!/usr/bin/env node

import Terser from 'terser';
import * as rollup from 'rollup';
import {promises as fs} from 'fs';

process.on('unhandledRejection', (e) => {
  console.error(e);
  process.exit(1);
});

async function build() {
  const bundle = await rollup.rollup({
    input: 'src/index.js',
  });
  const {output} = await bundle.generate({
    format: 'esm',
    sourcemap: true,
  });

  if (output.length !== 1) {
    throw new Error(`expected single output, was length: ${bundle.output.length}`);
  }

  let {code, map} = output[0];
  const rollupBytes = code.length;

  const out = Terser.minify(code, {mangle: {toplevel: true, safari10: true}, sourceMap: {content: map}});
  code = out.code;
  map = out.map;

  await fs.mkdir('dist/', {recursive: true});
  await fs.writeFile('dist/index.js', code);
  await fs.writeFile('dist/index.js.map', map);

  const reduction = 1.0 - (code.length / rollupBytes);
  console.info(`Ok (${code.length} bytes), compressed by ${(reduction * 100).toFixed(2)}%`);
}

build();

