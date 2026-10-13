import {spawnSync} from 'node:child_process';

const MAX_HTML = 1_500_000;
// A crawler subprocess does not need CI tokens, proxy credentials or app secrets.
export function workerEnvironment(environment=process.env) {
  const names=['PATH','SYSTEMROOT','WINDIR','TEMP','TMP','HOME','USERPROFILE','LOCALAPPDATA','APPDATA','PLAYWRIGHT_BROWSERS_PATH'];
  return {...Object.fromEntries(Object.entries(environment).filter(([key])=>names.includes(key.toUpperCase()))),PYTHONIOENCODING:'utf-8',PYTHONUTF8:'1'};
}
function run(input,args=[]) {
  const result=spawnSync(process.env.SCRAPLING_PYTHON||'python',['scripts/scrapling_worker.py',...args],{
    input:input?JSON.stringify(input):undefined,encoding:'utf8',env:workerEnvironment(),
    timeout:45_000,maxBuffer:5_000_000,windowsHide:true,shell:false,
  });
  if(result.error)throw Error(`Scrapling worker: ${result.error.code||'execution failed'}`);
  if(result.status!==0)throw Error(`Scrapling worker: ${(result.stderr||'execution failed').trim().slice(-300)}`);
  try{return JSON.parse(result.stdout);}catch{throw Error('Scrapling worker returned invalid JSON');}
}
export function checkScrapling() {return run(null,['--check']);}
export function validateScraplingResult(result,url) {
  if(!result||result.url!==url||typeof result.html!=='string'||Buffer.byteLength(result.html)>MAX_HTML||!Array.isArray(result.links)||result.links.length>24||typeof result.rendered!=='boolean'||typeof result.adaptiveUsed!=='boolean')throw Error('Invalid Scrapling document');
  for(const link of result.links)if(typeof link.title!=='string'||link.title.length>150||typeof link.url!=='string'||link.url.length>2048||link.publishedAt&&(typeof link.publishedAt!=='string'||link.publishedAt.length>100))throw Error('Invalid Scrapling discovery link');
  if(result.socialPosts&&(!Array.isArray(result.socialPosts)||result.socialPosts.length>12||result.socialPosts.some(url=>typeof url!=='string'||url.length>2048)))throw Error('Invalid Scrapling social links');
  if(result.posts&&(!Array.isArray(result.posts)||result.posts.length>24||result.posts.some(post=>typeof post.url!=='string'||typeof post.text!=='string'||post.text.length>2000||!Array.isArray(post.links)||post.links.length>30||post.links.some(url=>typeof url!=='string'||url.length>2048))))throw Error('Invalid Scrapling social posts');
  return result;
}
export function scraplingDocument(url,html,{render=false,social=null}={}) {
  if(Buffer.byteLength(html)>MAX_HTML)throw Error('Scrapling input too large');
  return validateScraplingResult(run({url,html,render,social}),url);
}
export function mayFollowAnnouncement(source,url) {
  try {
    const target=new URL(url),base=new URL(source.url);
    return target.origin===base.origin&&!target.search&&!target.hash&&!target.username&&!target.password&&
      (source.followPaths||[]).some(prefix=>target.pathname.startsWith(prefix))&&
      !/login|sign.?in|logout|register|scoreboard|privacy|download/i.test(target.pathname);
  }catch{return false;}
}
