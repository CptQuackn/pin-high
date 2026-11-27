#!/usr/bin/env node
/* Bundles src/ into single self-contained pages in dist/.
   dist/artifact.html  the exact page the Claude artifact host wraps in its own <html> skeleton (what we published as v118)
   dist/index.html     the same page with its own doctype/head, for hosting anywhere
   dist/test.html      index.html with three.js loaded from node_modules (offline render tests)
   Usage: node tools/build.js */
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),src=p=>fs.readFileSync(path.join(root,'src',p),'utf8');
const THREE_CDN='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const jsFiles=fs.readdirSync(path.join(root,'src','js')).filter(f=>f.endsWith('.js')).sort();
const engine=jsFiles.find(f=>/engine/.test(f)),app=jsFiles.filter(f=>f!==engine);
const body=src('body.html');
const page=(three)=>src('head.html')+'<style>\n'+src('style.css')+'</style>\n'+body+
  '<script src="'+three+'"></script>\n<script>\n'+src('js/'+engine)+'</script>\n<script>\n'+app.map(f=>src('js/'+f)).join('')+'</script>\n';
const out=(f,s)=>{fs.mkdirSync(path.join(root,'dist'),{recursive:true});fs.writeFileSync(path.join(root,'dist',f),s);console.log('wrote dist/'+f,(s.length/1024).toFixed(0)+' KB');};
out('artifact.html',page(THREE_CDN));
const skeleton=(inner)=>'<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'+
  '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html,body{margin:0}body{font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>\n'+
  inner+'</head>\n';
/* the source head holds <title>, meta and font links; the page body content follows the closing </style> */
const full=page(THREE_CDN),i=full.indexOf('</style>')+'</style>\n'.length;
out('index.html',skeleton(full.slice(0,i))+'<body>\n'+full.slice(i)+'</body>\n</html>\n');
const t=page('../node_modules/three/build/three.min.js'),j=t.indexOf('</style>')+'</style>\n'.length;
out('test.html',skeleton(t.slice(0,j))+'<body>\n'+t.slice(j).replace('let fitD=60,viewOff=0;','let fitD=60,viewOff=0;window.__cam={get cs(){return cs},get tgt(){return tgt},get H(){return H},yTop};')+'</body>\n</html>\n');
