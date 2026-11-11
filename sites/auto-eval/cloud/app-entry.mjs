import { openStorage } from './storage.mjs';
import { createPrivateApi } from './runtime.mjs';
try {
  const response=await fetch('/data/demo.json');
  if(!response.ok)throw new Error('无法读取教学数据，请刷新页面');
  const seed=await response.json();
  globalThis.__autoEvalApi=await createPrivateApi({store:await openStorage(),seed,spawn:()=>new Worker('/experiment-worker.js',{type:'module'})});
  await import('../public/app.js');
} catch(error) {
  const message=document.createElement('p');message.className='notice error';message.textContent=error.message;
  document.querySelector('#main').replaceChildren(message);
}
