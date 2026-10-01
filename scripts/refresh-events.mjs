import ts from 'typescript';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {lookup} from 'node:dns/promises';
import {createHash} from 'node:crypto';
import net from 'node:net';

// Only the reviewed URLs below and existing organizer URLs are fetched. Links
// found in social posts or in scraped HTML are recorded, never followed.
const officialWatch=[
  'https://glacierctf.com/',
  'https://wolvctf.io/',
  'https://www.foi.se/cratectf',
  'https://www.c0c0n.org/lea-ctf.php',
  'https://www.xploitxctf.me/',
  'https://csaw.io/',
  'https://capturetheflag.withgoogle.com/',
];
const publicFeeds=[
  'https://infosec.exchange/@fluxfingers.rss',
  'https://www.reddit.com/r/ctf/.rss',
];
const files=['events','verification','catalog-worldwide','catalog-expanded','auto-events','refresh-checks','catalog-data','ingestion-core'];
for(const name of files){
  const source=await readFile(`lib/${name}.ts`,'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from (["'])(\.\.?\/[^"']+)\1/g,(_all,quote,spec)=>`from ${quote}${spec}.mjs${quote}`);
  await mkdir('.scan-runtime',{recursive:true});
  await writeFile(`.scan-runtime/${name}.mjs`,compiled);
}
const [{seedEvents},{sameEdition,sameEventWindow,isSafeUrl,normalizeUrl},{publicationIssues},{extractOfficialPage,extractDiscoveryLeads,robotsAllowed}]=await Promise.all([
  import('../.scan-runtime/catalog-data.mjs'),import('../.scan-runtime/events.mjs'),import('../.scan-runtime/verification.mjs'),import('../.scan-runtime/ingestion-core.mjs')
]);
const now=new Date(), checkedAt=now.toISOString(), today=now.getTime();
const candidates=JSON.parse(await readFile('data/candidates.json','utf8'));
const leads=JSON.parse(await readFile('data/leads.json','utf8'));
const autoEvents=(await import('../.scan-runtime/auto-events.mjs')).autoEvents;
const refreshChecks=(await import('../.scan-runtime/refresh-checks.mjs')).refreshChecks;
const pages=[...new Set([...seedEvents.filter(e=>e.verification!=='review').map(e=>e.officialUrl),...officialWatch])];
const stats={checked:0,blocked:0,failed:0,matched:0,published:0,leads:0};

function publicAddress(address){
  if(net.isIP(address)===4){const [a,b]=address.split('.').map(Number);return !(
    a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===192&&b===0||a===198&&[18,19].includes(b));}
  if(net.isIP(address)===6){const s=address.toLowerCase();return !(s==='::1'||s==='::'||s.startsWith('fc')||s.startsWith('fd')||s.startsWith('fe8')||s.startsWith('fe9')||s.startsWith('fea')||s.startsWith('feb')||s.startsWith('::ffff:'));}
  return false;
}
async function safeFetch(url,limit=1_500_000){
  if(!isSafeUrl(url))throw Error('unsafe URL');
  const u=new URL(url),addresses=await lookup(u.hostname,{all:true});
  if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error('non-public host');
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(9000),headers:{'User-Agent':'SignalCTF/1.0 (+https://signal-ctf.vercel.app/sources)','Accept':'text/html, application/rss+xml, application/atom+xml, text/plain;q=0.8'}});
  if(!response.ok||response.status>=300)throw Error(`HTTP ${response.status}`);
  const type=response.headers.get('content-type')||'';
  if(!/text\/html|text\/plain|application\/(?:rss|atom)\+xml|application\/xml|text\/xml/i.test(type))throw Error('unsupported content type');
  const length=Number(response.headers.get('content-length')||0);
  if(length>limit)throw Error('page too large');
  const reader=response.body.getReader();let size=0,parts=[];
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('page too large');}parts.push(value);}
  const body=new Uint8Array(size);let offset=0;for(const part of parts){body.set(part,offset);offset+=part.length;}
  return new TextDecoder().decode(body);
}
const robotsCache=new Map();
async function allowed(url){
  const u=new URL(url);let rules=robotsCache.get(u.origin);
  if(rules===undefined){try{rules=await safeFetch(`${u.origin}/robots.txt`,100_000);}catch(error){
    // A missing robots file allows crawling; network/HTTP errors do not.
    if(String(error).includes('HTTP 404'))rules='';else throw error;
  }robotsCache.set(u.origin,rules);}
  return robotsAllowed(rules,u.pathname+u.search);
}
function key(event){return createHash('sha256').update(`${event.officialUrl}|${event.title.toLowerCase()}|${event.start.slice(0,4)}`).digest('hex').slice(0,16);}
function signature(event){return JSON.stringify([event.title,event.start,event.end,event.mode,event.officialUrl,event.cancelled]);}
function sameFact(field,a,b){return ['start','end'].includes(field)&&a&&b?Date.parse(a)===Date.parse(b):String(a||'')===String(b||'');}
function isKnownEdition(found){return seedEvents.find(e=>sameEdition(e,found)||sameEventWindow(e,found));}
function addLead(lead,force=false){if(!isSafeUrl(lead.officialUrl)||!force&&normalizeUrl(lead.officialUrl)===normalizeUrl(lead.sourceUrl)||leads.some(x=>normalizeUrl(x.officialUrl)===normalizeUrl(lead.officialUrl)))return;leads.push(lead);stats.leads++;}
function credibleNew(event,url){
  if(event.verification!=='review'||!event.end||!event.start.includes('T')||!event.end.includes('T'))return false;
  if(new URL(event.officialUrl).origin!==new URL(url).origin)return false;
  if(Date.parse(event.start)<today-86400000||Date.parse(event.start)>today+400*86400000||Date.parse(event.end)<=Date.parse(event.start))return false;
  if(!event.evidence.some(x=>x.field==='end'))return false;
  const proposed={...event,verification:'official'};
  return publicationIssues(proposed,today).length===0;
}
for(const url of pages){
  try{
    if(!await allowed(url)){stats.blocked++;continue;}
    const html=await safeFetch(url);stats.checked++;
    for(const lead of extractDiscoveryLeads(html,url,checkedAt))if(new URL(lead.officialUrl).origin===new URL(url).origin)addLead(lead);
    for(const found of extractOfficialPage(html,url,checkedAt)){
      const existing=isKnownEdition(found);
      if(existing){
        const fields=['title','start','end','mode'];
        if(fields.every(f=>sameFact(f,existing[f],found[f]))){
          stats.matched++;
          if(!refreshChecks[existing.id]||today-Date.parse(refreshChecks[existing.id])>3*86400000)refreshChecks[existing.id]=checkedAt;
        }else addLead({title:found.title,officialUrl:found.officialUrl,sourceUrl:url,discoveredAt:checkedAt,summary:'Official page differs from the published schedule or mode; review before changing the listing.'},true);
        continue;
      }
      if(!credibleNew(found,url)){
        addLead({title:found.title,officialUrl:found.officialUrl,sourceUrl:url,discoveredAt:checkedAt,summary:'Official announcement needs more detail or human review before publication.'},true);
        continue;
      }
      const id=key(found),sig=signature(found),prior=candidates[id];
      if(prior&&prior.signature===sig&&today-Date.parse(prior.firstSeen)>=5*3600000){
        const published={...found,id:`auto-${id}`,verification:'official',notes:['Parsed from an approved organizer page and checked on two runs at least five hours apart.','Fees, prizes, and eligibility were not inferred from announcement text.']};
        if(!isKnownEdition(published)&&!autoEvents.some(e=>sameEdition(e,published))){autoEvents.push(published);stats.published++;}
        delete candidates[id];
      }else if(!prior||prior.signature!==sig)candidates[id]={event:found,firstSeen:checkedAt,signature:sig};
    }
  }catch(error){stats.failed++;console.warn(`Skipped ${new URL(url).hostname}: ${String(error).slice(0,150)}`);}
}
for(const url of publicFeeds){try{if(!await allowed(url)){stats.blocked++;continue;}const body=await safeFetch(url,600_000);for(const lead of extractDiscoveryLeads(body,url,checkedAt))addLead(lead);}catch(error){console.warn(`Feed unavailable ${new URL(url).hostname}: ${String(error).slice(0,150)}`);}}
for(const [id,c] of Object.entries(candidates))if(Date.parse(c.firstSeen)<today-30*86400000||isKnownEdition(c.event))delete candidates[id];
const cleanLeads=leads.filter(l=>Date.parse(l.discoveredAt)>today-120*86400000).slice(-150);
if(!process.argv.includes('--dry-run')){
  await writeFile('data/candidates.json',JSON.stringify(candidates,null,2)+'\n');
  await writeFile('data/leads.json',JSON.stringify(cleanLeads,null,2)+'\n');
  await writeFile('lib/auto-events.ts',`import type {CTFEvent} from './events';\n// Generated after two matching checks of an approved public organizer page.\nexport const autoEvents:CTFEvent[]=${JSON.stringify(autoEvents,null,2)};\n`);
  await writeFile('lib/refresh-checks.ts',`// Generated only when a strict official-page parser still matches a catalog event.\nexport const refreshChecks:Record<string,string>=${JSON.stringify(refreshChecks,null,2)};\n`);
}
console.log(JSON.stringify({...stats,candidates:Object.keys(candidates).length,autoEvents:autoEvents.length},null,2));
