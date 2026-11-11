import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const publicRoot=path.join(root,'public');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
export function resolvePublicPath(pathname) {
  let decoded;try{decoded=decodeURIComponent(pathname);}catch{return null;}
  if(decoded.includes('\0'))return null;
  const filename=path.resolve(publicRoot,'.'+(decoded==='/'?'/index.html':decoded));
  return filename.startsWith(publicRoot+path.sep)?filename:null;
}
export async function handle(request) {
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
  const url=new URL(request.url);
  let filename;
  if(url.pathname==='/api/health')return Response.json({name:'EvalPapers',status:'ok',mode:'local-snapshot'});
  if(url.pathname==='/api/papers'||url.pathname==='/data/catalog.json')filename=path.join(root,'data/catalog.json');
  else filename=resolvePublicPath(url.pathname);
  if(!filename)return new Response('Forbidden',{status:403});
  try{
    const body=await readFile(filename);
    return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
  }catch{return new Response('Not found',{status:404});}
}
export function createServer(){return http.createServer(async(req,res)=>{
  try{const response=await handle(new Request(new URL(req.url,'http://localhost'),{method:req.method}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}
  catch{res.writeHead(500);res.end('Internal server error');}
});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const port=Number(process.env.PORT||4322);const server=createServer();server.listen(port,'127.0.0.1',()=>console.log(`EvalPapers → http://localhost:${port}`));}
