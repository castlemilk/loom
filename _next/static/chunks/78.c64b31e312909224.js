"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[78],{4447:(e,t,o)=>{o.d(t,{D3:()=>i,E8:()=>a,IF:()=>n,lm:()=>s,pr:()=>r});let n="npm install\nnpm run dev";function r(e){let t="ts"===e;return`import { mountScene${t?", type GraphScene":""} } from 'loom-core/scene'${t?"\nimport { graph as data } from './data.js'":""}

export async function mountGraph(canvas${t?": HTMLCanvasElement":""}, workerURL${t?"?: string":""}) {
  const response = await fetch(new URL('./scene.json', import.meta.url))
  if (!response.ok) throw new Error('Could not load scene.json (' + response.status + ')')
  const scene${t?": GraphScene":""} = await response.json()
  const graph = mountScene(canvas, ${t?"{ ...scene, data }":"scene"}, { workerURL })
  graph.on('open', id => graph.focus(id))
  return graph
}`}function a(e){return e.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,"-").replace(/^-|-$/g,"").slice(0,80)||"loom-graph"}function s(e,t,o){return{name:e,private:!0,type:"module",scripts:{dev:"vite",build:(o?"tsc --noEmit && ":"")+"vite build --base=./",preview:"vite preview"},dependencies:{"loom-core":t},devDependencies:{vite:"7.3.8",...o&&{typescript:"5.9.3"}}}}async function i({name:e,scene:t,language:a,dependency:l,dataModule:c,dataTypes:d}){let p,{strToU8:u,zip:m}=await o.e(602).then(o.bind(o,602)),h="ts"===a,g=s("loom-graph-export",l,h),b=`# Your Loom graph

Use Node.js 22.12 or newer. From this folder, install the dependencies and start the development server.

\`\`\`sh
${n}
\`\`\`

Open the local URL printed by Vite. To deploy the graph, run \`npm run build\` and serve the generated \`dist/\` directory.

To use the graph in an existing app, copy \`scene.json\`, ${h?"`data.ts`, `notebook-types.ts` and ":"and "}\`graph.${a}\` together, install the loom-core dependency from package.json, and call \`await mountGraph(canvas)\` after your canvas has a width and height. Keep the returned graph and call \`graph.destroy()\` when the canvas unmounts.

The starter passes Vite's bundled layout worker URL for large graphs. With another bundler, you can serve the package's layout-worker.js and pass its URL as the second argument. Artwork URLs in the scene are fetched from their original hosts.
`,f={"package.json":u(JSON.stringify(g,null,2)+"\n"),...h&&{"tsconfig.json":u(JSON.stringify({compilerOptions:{target:"ES2022",module:"ESNext",moduleResolution:"Bundler",strict:!0,noEmit:!0},include:["graph.ts"]},null,2)+"\n")},"index.html":u((p=e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"),`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${p}</title>
  <style>
    * { box-sizing: border-box }
    body { margin: 0; height: 100dvh; display: grid; grid-template-rows: auto minmax(0, 1fr); font: 15px/1.4 system-ui, sans-serif; color: #293229; background: #faf9f3 }
    header { display: flex; align-items: center; gap: 1rem; padding: .75rem 1rem; border-bottom: 1px solid #d3d5cb }
    h1 { margin: 0; flex: 1; font: 600 1.1rem/1.3 system-ui, sans-serif; overflow-wrap: anywhere }
    output { font-size: .85rem; overflow-wrap: anywhere }
    button { font: inherit; padding: .35rem .7rem; white-space: nowrap }
    canvas { display: block; width: 100%; height: 100%; min-height: 0 }
  </style>
</head>
<body>
  <header><h1>${p}</h1><output role="status">Loading graph…</output><button disabled>Fit view</button></header>
  <canvas aria-label="Interactive graph"></canvas>
  <script type="module">
    import { mountGraph } from './graph.${a}'
    import workerURL from 'loom-core/layout-worker.js?url'

    const status = document.querySelector('output')
    const fit = document.querySelector('button')
    mountGraph(document.querySelector('canvas'), workerURL).then(graph => {
      status.textContent = ''
      fit.disabled = false
      fit.onclick = () => graph.fit()
      graph.on('select', id => { status.textContent = id ?? '' })
      window.addEventListener('pagehide', event => { if (!event.persisted) graph.destroy() })
    }).catch(error => { status.textContent = error.message })
  </script>
</body>
</html>
`)),["graph."+a]:u(r(a)+"\n"),...h&&{"data.ts":u(c),"notebook-types.ts":u(d)},"scene.json":u(JSON.stringify(t,null,2)+"\n"),"README.md":u(b)};return new Promise((e,t)=>m(f,{level:1},(o,n)=>{o?t(o):e(n)}))}},5078:(e,t,o)=>{o.d(t,{downloadNotebook:()=>i});var n=o(4447),r=o(8017),a=o(9177),s=o(9046);async function i(e,t,i){let{strToU8:l,zipSync:c}=await o.e(602).then(o.bind(o,602)),d=Object.fromEntries(Object.entries({"notebook.ts":t,"index.html":a.pr,"notebook-types.ts":a.bE,"mount-notebook.ts":a.fs,"package.json":JSON.stringify((0,n.lm)("loom-orbital-notebook",s.Gs,!0),null,2),"tsconfig.json":JSON.stringify({compilerOptions:{strict:!0,target:"ES2022",module:"ESNext",moduleResolution:"Bundler",noEmit:!0},include:["*.ts"]},null,2),"README.md":"# Orbital notebook\n\nUse Node.js 22.12 or newer. From this folder run\n\n```sh\n"+n.IF+"\n```\n\nEdit notebook.ts and select a card to inspect its metadata. Put custom relative image files in public/images/. Absolute image URLs load from their original hosts. Run npm run build for a static site in dist/.\n"}).map(([e,t])=>[e,l(t)]));await Promise.all(["saturn.webp","titan.webp","enceladus.webp","cassini.webp","CREDITS.md"].map(async e=>{let t=await fetch(new URL(e,i));if(!t.ok)throw Error("Could not download "+e+". Try again.");d["public/images/"+e]=new Uint8Array(await t.arrayBuffer())})),(0,r.P)("loom-"+e+".zip",c(d,{level:1}),"application/zip")}},8017:(e,t,o)=>{o.d(t,{P:()=>n});function n(e,t,o){let n=URL.createObjectURL(new Blob([t],{type:o})),r=document.createElement("a");r.href=n,r.download=e,document.body.append(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3)}},9046:e=>{e.exports=JSON.parse('{"Gs":"https://castlemilk.github.io/loom/packages/65b497f5264036e9c98fb79c290c4badb6d66b63/loom-core-0.1.0.tgz","NF":"https://castlemilk.github.io/loom/packages/65b497f5264036e9c98fb79c290c4badb6d66b63/loom-core-0.1.0.tgz"}')}}]);