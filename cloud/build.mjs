import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import sharp from 'sharp';
const root=process.cwd();await fs.rm('dist',{recursive:true,force:true});await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/client/assets',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});
await build({entryPoints:['cloud/worker.mjs'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,plugins:[{name:'portable-crypto',setup(b){b.onResolve({filter:/^node:crypto$/},()=>({path:path.join(root,'cloud/crypto.mjs')}));}}]});
await fs.writeFile('dist/server/package.json','{"type":"module"}');
for(const name of ['index.html','script.js','style.css','data.js','core.js','layers.js']){let text=await fs.readFile(name,'utf8');text=text.replaceAll('.png','.webp');await fs.writeFile('dist/client/'+name,text);}
let count=0,bytes=0;
for(const dir of ['scenes','cutouts','layers']){await fs.mkdir('dist/client/assets/'+dir,{recursive:true});for(const name of await fs.readdir('assets/'+dir)){if(!name.endsWith('.png'))continue;const out='dist/client/assets/'+dir+'/'+name.replace('.png','.webp');await sharp('assets/'+dir+'/'+name).webp({quality:88,alphaQuality:100}).toFile(out);bytes+=(await fs.stat(out)).size;count++;}}
await sharp('assets/map-ground.png').webp({quality:92}).toFile('dist/client/assets/map-ground.webp');
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');await fs.cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log(`Built cloud room server and ${count+1} transparent/scenery assets (${(bytes/1024/1024).toFixed(1)} MB plus map).`);
