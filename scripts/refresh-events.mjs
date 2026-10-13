import ts from 'typescript';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {lookup} from 'node:dns/promises';
import {createHash} from 'node:crypto';
import net from 'node:net';
import {checkScrapling,scraplingDocument,mayFollowAnnouncement} from './scrapling-client.mjs';
import {socialPlatform,isSocialPermalink,socialLeads,sourceStatus,isAnnouncementLead} from './social-discovery.mjs';
import {createRobotsGuard} from './source-policy.mjs';

// Social links remain review leads. Only explicit organizer path prefixes may
// be followed, to one level, with the same robots and public-host checks.
const sources=JSON.parse(await readFile('data/scraping-sources.json','utf8'));
const useScrapling=process.argv.includes('--scrapling');
const daily=process.argv.includes('--daily');
const scraperVersion=useScrapling?checkScrapling().scrapling:null;
const officialWatch=sources.organizers.map(source=>source.url);
const publicFeeds=daily?sources.feeds:sources.feeds.slice(0,2);
const files=['events','verification','catalog-worldwide','catalog-expanded','auto-events','refresh-checks','catalog-data','ingestion-core','source-health'];
for(const name of files){
  const source=await readFile(`lib/${name}.ts`,'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from (["'])(\.\.?\/[^"']+)\1/g,(_all,quote,spec)=>`from ${quote}${spec}.mjs${quote}`);
  await mkdir('.scan-runtime',{recursive:true});
  await writeFile(`.scan-runtime/${name}.mjs`,compiled);
}
const [{seedEvents},{sameCatalogEdition,isSafeUrl,normalizeUrl},{publicationIssues},{extractOfficialPage,extractDiscoveryLeads,robotsAllowed}]=await Promise.all([
  import('../.scan-runtime/catalog-data.mjs'),import('../.scan-runtime/events.mjs'),import('../.scan-runtime/verification.mjs'),import('../.scan-runtime/ingestion-core.mjs')
]);
const now=new Date(), checkedAt=now.toISOString(), today=now.getTime();
const candidates=JSON.parse(await readFile('data/candidates.json','utf8'));
const leads=JSON.parse(await readFile('data/leads.json','utf8'));
const autoEvents=(await import('../.scan-runtime/auto-events.mjs')).autoEvents;
const refreshChecks=(await import('../.scan-runtime/refresh-checks.mjs')).refreshChecks;
const priorHealth=(await import('../.scan-runtime/source-health.mjs')).sourceHealth;
const approvedPages=[...new Set([...seedEvents.filter(e=>e.verification!=='review').map(e=>e.officialUrl),...officialWatch])];
const selected=process.argv.find(arg=>arg.startsWith('--source='))?.slice(9);
if(selected&&!approvedPages.includes(selected))throw Error('--source must be an approved organizer URL');
const pages=selected?[selected]:[...approvedPages];
const seen=new Set(pages),report=[];
const socialQueue=daily?[...sources.social]:[],socialSeen=new Set(socialQueue.map(source=>source.url));
const stats={checked:0,blocked:0,failed:0,matched:0,published:0,leads:0,scraplingParsed:0,rendered:0,renderFailed:0,adaptive:0,followed:0,communityChecked:0,feedChecked:0,socialChecked:0,socialPosts:0};
function queueSocialPosts(document,verifiedFrom){
  if(!daily)return;
  for(const url of document.socialPosts||[]){
    if(socialQueue.length>=sources.social.length+12)break;
    if(isSafeUrl(url)&&isSocialPermalink(url)&&!socialSeen.has(url)){
      socialSeen.add(url);socialQueue.push({url,platform:socialPlatform(url),verifiedFrom});
    }
  }
}

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
const allowed=createRobotsGuard(safeFetch,robotsAllowed);
function key(event){return createHash('sha256').update(`${event.officialUrl}|${event.title.toLowerCase()}|${event.start.slice(0,4)}`).digest('hex').slice(0,16);}
function signature(event){return JSON.stringify([event.title,event.start,event.end,event.mode,event.officialUrl,event.cancelled]);}
function sameFact(field,a,b){return ['start','end'].includes(field)&&a&&b?Date.parse(a)===Date.parse(b):String(a||'')===String(b||'');}
function isKnownEdition(found){return seedEvents.find(e=>sameCatalogEdition(e,found));}
function addLead(lead,force=false){
  const identity=lead.announcementUrl||lead.officialUrl;
  if(!isSafeUrl(lead.officialUrl)||!isAnnouncementLead(lead,checkedAt)||!force&&normalizeUrl(lead.officialUrl)===normalizeUrl(lead.sourceUrl)||leads.some(x=>normalizeUrl(x.announcementUrl||x.officialUrl)===normalizeUrl(identity)))return;
  leads.push(lead);stats.leads++;
}
function credibleNew(event,url){
  if(event.verification!=='review'||!event.end||!event.start.includes('T')||!event.end.includes('T'))return false;
  if(new URL(event.officialUrl).origin!==new URL(url).origin)return false;
  if(Date.parse(event.start)<today-86400000||Date.parse(event.start)>today+400*86400000||Date.parse(event.end)<=Date.parse(event.start))return false;
  if(!event.evidence.some(x=>x.field==='end'))return false;
  const proposed={...event,verification:'official'};
  return publicationIssues(proposed,today).length===0;
}
for(const url of pages){
  const sourceReport={url,channel:'organizer',status:'pending'};
  report.push(sourceReport);
  try{
    if(!await allowed(url)){stats.blocked++;sourceReport.status='robots-blocked';continue;}
    let html=await safeFetch(url);stats.checked++;
    const profile=sources.organizers.find(source=>source.url===url);
    if(useScrapling){
      const document=scraplingDocument(url,html,{render:!!profile?.render&&extractOfficialPage(html,url,checkedAt).length===0});
      queueSocialPosts(document,url);
      html=document.html;stats.scraplingParsed++;
      if(document.rendered)stats.rendered++;
      if(document.renderError)stats.renderFailed++;
      if(document.adaptiveUsed)stats.adaptive++;
      sourceReport.rendered=document.rendered;
      sourceReport.adaptiveUsed=document.adaptiveUsed;
      if(document.renderError)sourceReport.renderError=document.renderError;
      let followed=0;
      for(const link of document.links){
        if(!isSafeUrl(link.url)||new URL(link.url).origin!==new URL(url).origin||!isAnnouncementLead({...link,officialUrl:link.url},checkedAt))continue;
        addLead({title:link.title,officialUrl:link.url,sourceUrl:url,discoveredAt:checkedAt,...(link.publishedAt?{publishedAt:link.publishedAt}:{}),summary:'Discovered with Scrapling. Official schedule and participation details need verification.'});
        if(profile&&mayFollowAnnouncement(profile,link.url)&&!seen.has(link.url)&&followed<3&&stats.followed<8){
          seen.add(link.url);pages.push(link.url);followed++;stats.followed++;
        }
      }
    }
    sourceReport.status='checked';
    if(!useScrapling)for(const lead of extractDiscoveryLeads(html,url,checkedAt))if(new URL(lead.officialUrl).origin===new URL(url).origin)addLead(lead);
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
        if(!isKnownEdition(published)&&!autoEvents.some(e=>sameCatalogEdition(e,published))){autoEvents.push(published);stats.published++;}
        delete candidates[id];
      }else if(!prior||prior.signature!==sig)candidates[id]={event:found,firstSeen:checkedAt,signature:sig};
    }
  }catch(error){stats.failed++;sourceReport.status=sourceStatus(error);sourceReport.error=String(error).slice(0,160);console.warn(`Skipped ${new URL(url).hostname}: ${String(error).slice(0,150)}`);}
}
if(daily&&!selected)for(const source of sources.communities){
  const entry={url:source.url,channel:'community',status:'pending'};report.push(entry);
  try{
    if(!await allowed(source.url)){stats.blocked++;entry.status='robots-blocked';continue;}
    let html=await safeFetch(source.url);stats.communityChecked++;
    if(useScrapling){const document=scraplingDocument(source.url,html);html=document.html;queueSocialPosts(document,source.url);for(const link of document.links)if(isSafeUrl(link.url))addLead({title:link.title,officialUrl:link.url,sourceUrl:source.url,discoveredAt:checkedAt,...(link.publishedAt?{publishedAt:link.publishedAt}:{}),channel:'community',summary:'Community announcement. Official organizer evidence is required before publication.'});}
    else for(const lead of extractDiscoveryLeads(html,source.url,checkedAt))addLead({...lead,channel:'community'});
    entry.status='checked';
  }catch(error){entry.status=sourceStatus(error);entry.error=String(error).slice(0,160);}
}
if(!selected)for(const url of publicFeeds){
  const entry={url,channel:'feed',status:'pending'};report.push(entry);
  try{if(!await allowed(url)){stats.blocked++;entry.status='robots-blocked';continue;}const body=await safeFetch(url,600_000);stats.feedChecked++;for(const lead of extractDiscoveryLeads(body,url,checkedAt))addLead({...lead,channel:'feed'});entry.status='checked';}catch(error){entry.status=sourceStatus(error);entry.error=String(error).slice(0,160);console.warn(`Feed unavailable ${new URL(url).hostname}: ${String(error).slice(0,150)}`);}
}
if(daily&&!selected)for(const source of socialQueue){
  const entry={url:source.url,channel:source.platform,status:'pending'};report.push(entry);
  try{
    if(!await allowed(source.url)){stats.blocked++;entry.status='robots-blocked';continue;}
    const html=await safeFetch(source.url);
    if(!useScrapling){entry.status='parser-required';continue;}
    const document=scraplingDocument(source.url,html,{social:source.platform});
    stats.socialChecked++;stats.socialPosts+=(document.posts||[]).length;
    for(const lead of socialLeads(document,source,checkedAt,isSafeUrl))addLead(lead,true);
    entry.status=document.restricted?'login-required':document.posts?.length?'checked':'no-public-posts';
  }catch(error){entry.status=sourceStatus(error);entry.error=String(error).slice(0,160);}
}
for(const [id,c] of Object.entries(candidates))if(Date.parse(c.firstSeen)<today-30*86400000||isKnownEdition(c.event))delete candidates[id];
const cleanLeads=leads.filter(l=>Date.parse(l.discoveredAt)>today-120*86400000).slice(-300);
const completedAt=new Date().toISOString();
if(!process.argv.includes('--dry-run')){
  await writeFile('data/candidates.json',JSON.stringify(candidates,null,2)+'\n');
  await writeFile('data/leads.json',JSON.stringify(cleanLeads,null,2)+'\n');
  await writeFile('lib/auto-events.ts',`import type {CTFEvent} from './events';\n// Generated after two matching checks of an approved public organizer page.\nexport const autoEvents:CTFEvent[]=${JSON.stringify(autoEvents,null,2)};\n`);
  await writeFile('lib/refresh-checks.ts',`// Generated only when a strict official-page parser still matches a catalog event.\nexport const refreshChecks:Record<string,string>=${JSON.stringify(refreshChecks,null,2)};\n`);
  if(!selected){
    const healthSources=new Map(priorHealth.sources.map(source=>[source.url,source]));
    for(const entry of report)healthSources.set(entry.url,{url:entry.url,channel:entry.channel,status:entry.status,checkedAt});
    const health={lastOrganizerCheck:completedAt,lastDailyCheck:daily?completedAt:priorHealth.lastDailyCheck,sources:[...healthSources.values()].slice(-150)};
    await writeFile('lib/source-health.ts',`export type SourceCheck = {url:string;channel:string;status:string;checkedAt:string};\nexport type SourceHealth = {lastOrganizerCheck:string|null;lastDailyCheck:string|null;sources:SourceCheck[]};\n// Source status metadata only; no raw documents or credentials.\nexport const sourceHealth:SourceHealth=${JSON.stringify(health,null,2)};\n`);
  }
}
const summary={...stats,candidates:Object.keys(candidates).length,autoEvents:autoEvents.length};
await writeFile('.scan-runtime/scraping-report.json',JSON.stringify({checkedAt,completedAt,mode:daily?'daily':'official',scrapling:scraperVersion,summary,sources:report},null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,`CTF source check (${useScrapling?'Scrapling '+scraperVersion:'native'}): ${stats.checked} pages checked, ${stats.matched} official matches, ${stats.published} published, ${stats.leads} review leads. Browser: ${stats.rendered} rendered, ${stats.renderFailed} failed. Sources: ${stats.blocked} blocked, ${stats.failed} failed.\n`,{flag:'a'});
if(process.env.GITHUB_STEP_SUMMARY&&daily)await writeFile(process.env.GITHUB_STEP_SUMMARY,`Daily sweep: ${stats.communityChecked} community pages, ${stats.feedChecked} feeds, ${stats.socialChecked} social pages read, ${stats.socialPosts} public posts extracted. Restricted or unavailable sources remain visible in the report.\n`,{flag:'a'});
console.log(JSON.stringify(summary,null,2));
if(!stats.checked||useScrapling&&!stats.scraplingParsed)throw Error('No organizer documents could be checked; inspect the source report');
