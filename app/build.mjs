import { build } from 'esbuild';
import fs from 'fs';
const wk = await build({ entryPoints: ['node_modules/pdfjs-dist/build/pdf.worker.min.mjs'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2022', legalComments: 'none' });
fs.writeFileSync('src/_pdfworker.js', 'export default ' + JSON.stringify(wk.outputFiles[0].text) + ';\n');
const r = await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2022', legalComments: 'none' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync('src/template.html', 'utf8').replace('/*BUNDLE*/', () => js);
fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/MoPhongDieuDongTau.html', html);
console.log('built', (html.length / 1024).toFixed(0), 'KB');
