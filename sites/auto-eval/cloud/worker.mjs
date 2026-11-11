const headers = {'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"};
const json=(data,status=200)=>Response.json(data,{status,headers:{...headers,'Cache-Control':'no-store'}});
export default {
  async fetch(request,env) {
    try {
      const url=new URL(request.url);
      if(!['GET','HEAD'].includes(request.method))return json({error:'在线数据仅保存在访问者浏览器，不接受服务端写入'},405);
      if(url.pathname==='/api/health')return json({ok:true,project:'auto-eval',runtime:'browser',storage:'private-indexeddb'});
      if(url.pathname==='/api/config')return json({providerConfigured:false,model:null,maxExperiments:36,version:'0.2.0',runtime:'browser'});
      if(url.pathname.startsWith('/api/'))return json({error:'实验记录仅在当前浏览器内可用'},404);
      const response=await env.ASSETS.fetch(request);
      const result=new Response(response.body,response);
      for(const [name,value] of Object.entries(headers))result.headers.set(name,value);
      if(/\.(js|css)$/.test(url.pathname)||url.pathname==='/')result.headers.set('Cache-Control','no-cache');
      return result;
    } catch { return json({error:'页面暂时不可用，请稍后重试'},500); }
  },
};
