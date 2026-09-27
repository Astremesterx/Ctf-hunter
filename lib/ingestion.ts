import { db, seed, notifyEvent } from './store';
import { isSafeUrl, eventKey, sameEdition, type CTFEvent } from './events';
import { robotsAllowed, fingerprintText, extractOfficialPage, extractDiscoveryLeads } from './ingestion-core';
export type Source = {id:string;name:string;url:string;approved:number;permission_note:string|null;adapter:string;last_attempt:string|null;last_success:string|null;hash:string|null;status:string;failure:string|null};

async function boundedFetch(url:string) {
  if(!isSafeUrl(url)) throw Error('Unsafe source URL');
  const response = await fetch(url, {
    headers:{'User-Agent':'SignalCTF/1.0 (+public event verification; low-frequency requests)','Accept':'text/html,text/plain,application/ld+json,application/rss+xml,application/atom+xml'},
    redirect:'manual',signal:AbortSignal.timeout(12000),
  });
  if(response.status>=300&&response.status<400) throw Error('Redirect requires reviewer approval of the destination URL');
  if(Number(response.headers.get('content-length'))>524288) throw Error('Source exceeds 512 KB limit');
  const reader=response.body?.getReader(), decoder=new TextDecoder();
  let text='',size=0;
  if(reader) {try {while(true) {const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>524288)throw Error('Source exceeds 512 KB limit');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();} finally {await reader.cancel();}}
  return {status:response.status,ok:response.ok,text};
}
async function hash(value:string) {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');}

export async function runSource(id:string) {
  await seed();
  const d=db(),source=await d.prepare('SELECT * FROM sources WHERE id=?').bind(id).first<Source>();
  if(!source||!source.approved||!source.permission_note)throw Error('Source permission must be reviewed before importing.');
  const now=new Date().toISOString(),cutoff=new Date(Date.now()-5*60000).toISOString();
  const lock=await d.prepare('UPDATE sources SET last_attempt=?,status=? WHERE id=? AND (last_attempt IS NULL OR last_attempt<?)').bind(now,'Checking',id,cutoff).run();
  if(!lock.meta.changes)return {status:'skipped',message:'This source was checked recently. Try again in five minutes.'};
  let status='success',message='';
  const queue=async(key:string,kind:string,payload:unknown)=>{
    const result=await d.prepare("INSERT OR IGNORE INTO submissions (id,user_id,kind,payload,status,created_at,updated_at) VALUES (?,?,?,?,'pending',?,?)").bind(key,'ingestion:'+id,kind,JSON.stringify(payload),now,now).run();
    return result.meta.changes||0;
  };
  try {
    const url=new URL(source.url);
    if(url.hostname==='ctftime.org'||url.hostname.endsWith('.ctftime.org'))throw Error('CTFtime ingestion is disabled by its API reuse terms.');
    const robots=await boundedFetch(url.origin+'/robots.txt');
    if(robots.status!==404&&(!robots.ok||!robotsAllowed(robots.text,url.pathname+url.search)))throw Error('Robots rules do not permit this request, or could not be checked.');
    const page=await boundedFetch(source.url);
    if(!page.ok)throw Error(`Source returned HTTP ${page.status}. No event data was changed.`);
    const digest=await hash(fingerprintText(page.text));
    const extracted=extractOfficialPage(page.text,source.url,now);
    // Match the edition as well as its old date so rescheduling preserves saves.
    const rows=await d.prepare('SELECT id,payload FROM events WHERE published=1').all<{id:string;payload:string}>();
    const published=rows.results.map(r=>JSON.parse(r.payload) as CTFEvent);
    let queued=0,confirmed=0;
    for(const candidate of extracted) {
      const matches=published.filter(e=>eventKey(e)===eventKey(candidate)||sameEdition(e,candidate));
      const e=matches.length===1?matches[0]:null;
      if(e) {
        candidate.id=e.id;
        const equalTime=(a:string|null,b:string|null)=>a===b||a!==null&&b!==null&&Date.parse(a)===Date.parse(b);
        const same=equalTime(e.start,candidate.start)&&equalTime(e.end,candidate.end)&&e.mode===candidate.mode&&!!e.cancelled===!!candidate.cancelled;
        if(same&&e.verification!=='review') {
          e.checkedAt=now;
          e.evidence=e.evidence.map(s=>s.kind==='official'&&s.url===source.url&&['title','start','end','mode'].includes(s.field)?{...s,checkedAt:now}:s);
          await d.prepare('UPDATE events SET payload=?,updated_at=? WHERE id=?').bind(JSON.stringify(e),now,e.id).run();
          confirmed++;continue;
        }
        if(!same) {
          const wasReviewed=e.verification!=='review';
          e.verification='review';
          const note='The latest official-page check found changed core details. A reviewer is comparing the new evidence.';
          e.notes=[note,...e.notes.filter(n=>n!==note)].slice(0,12);
          await d.prepare('UPDATE events SET payload=?,updated_at=? WHERE id=?').bind(JSON.stringify(e),now,e.id).run();
          if(wasReviewed)await notifyEvent(e,`${e.title}: the official source changed. Dates are under review; please check before making plans.`,'source-change:'+id+':'+digest);
          candidate.summary=e.summary;candidate.categories=e.categories;candidate.notes=[...candidate.notes,...e.notes].slice(0,12);
          candidate.evidence=[...e.evidence.filter(s=>!candidate.evidence.some(c=>c.field===s.field)),...candidate.evidence].slice(0,40);
        }
      }
      const queueId='source:'+await hash(eventKey(candidate)+'|'+candidate.end+'|'+candidate.cancelled+'|'+candidate.mode);
      queued+=await queue(queueId,'discovered',candidate);
    }
    if(!extracted.length) {
      for(const lead of extractDiscoveryLeads(page.text,source.url,now)) {
        if(published.some(e=>sameEdition(e,lead)))continue;
        queued+=await queue('lead:'+await hash(lead.officialUrl+'|'+lead.title),'discovery-lead',lead);
      }
    }
    if(source.hash&&source.hash!==digest)queued+=await queue('changed:'+id+':'+digest,'source-change',{sourceId:id,officialUrl:source.url,title:source.name,message:'Visible source content changed. Review dates, cancellation notices, registration, and any new announcements.'});
    message=extracted.length?`${extracted.length} event schedules read; ${confirmed} confirmed; ${queued} review items added.`:`Source checked; ${queued} announcement leads or changes queued. No event verification dates advanced.`;
    await d.prepare('UPDATE sources SET last_success=?,hash=?,status=?,failure=NULL WHERE id=?').bind(now,digest,queued?'Review items queued':'Checked',id).run();
  } catch(e) {
    status='failed';message=(e as Error).message;
    await d.prepare('UPDATE sources SET status=?,failure=? WHERE id=?').bind('Check failed',message,id).run();
  }
  await d.prepare('INSERT INTO runs (id,source_id,status,message,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),id,status,message,now).run();
  return {status,message};
}
export async function runDueSources(limit=3) {
  await seed();
  const rows=await db().prepare('SELECT id FROM sources WHERE approved=1 AND (last_attempt IS NULL OR last_attempt<?) ORDER BY last_attempt LIMIT ?').bind(new Date(Date.now()-6*3600000).toISOString(),Math.max(1,Math.min(limit,5))).all<{id:string}>();
  const results=[];
  for(const row of rows.results)results.push(await runSource(row.id));
  return results;
}
