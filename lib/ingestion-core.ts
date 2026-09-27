import {isSafeUrl,type CTFEvent,type Evidence} from './events';
export function robotsAllowed(content:string,path:string,agent='SignalCTF'){
 const groups:{agents:string[];rules:{allow:boolean;path:string}[]}[]=[];let group:{agents:string[];rules:{allow:boolean;path:string}[]}|null=null;
 for(const raw of content.split(/\r?\n/)){const line=raw.split('#')[0].trim(),i=line.indexOf(':');if(i<0)continue;const key=line.slice(0,i).trim().toLowerCase(),v=line.slice(i+1).trim();if(key==='user-agent'){if(!group||group.rules.length){group={agents:[],rules:[]};groups.push(group);}group.agents.push(v.toLowerCase());}else if(group&&['allow','disallow'].includes(key)&&v)group.rules.push({allow:key==='allow',path:v});}
 const specific=groups.filter(g=>g.agents.some(a=>a!=='*'&&agent.toLowerCase().includes(a)));const candidates=specific.length?specific:groups.filter(g=>g.agents.includes('*'));let best={length:-1,allow:true};
 for(const r of candidates.flatMap(g=>g.rules)){const expression='^'+r.path.split('*').map(p=>p.replace(/[.+?^${}()|[\]\\]/g,'\\$&')).join('.*').replace(/\\\$$/,'$');if(new RegExp(expression).test(path)){const length=r.path.replace(/[*$]/g,'').length;if(length>best.length||(length===best.length&&r.allow))best={length,allow:r.allow};}}return best.allow;
}
export function fingerprintText(html:string){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim();}

export type DiscoveryLead = {title:string;officialUrl:string;discoveredAt:string;sourceUrl:string;summary:string};
// Feed publication timestamps are never treated as competition start dates.
export function extractDiscoveryLeads(html:string,sourceUrl:string,checkedAt:string):DiscoveryLead[]{
 const leads:DiscoveryLead[]=[];
 function add(title:string,link:string,summary:string){try{const url=new URL(link.replace(/&amp;/g,'&'),sourceUrl).toString();const clean=fingerprintText(title);if(!isSafeUrl(url)||!/(\bctf\b|ctf\s*20\d{2}|capture.the.flag)/i.test(clean)||leads.some(l=>l.officialUrl===url))return;leads.push({title:clean.slice(0,150),officialUrl:url,sourceUrl,discoveredAt:checkedAt,summary:fingerprintText(summary).slice(0,600)||'Announcement discovered. Official dates and participation details need review.'});}catch{}}
 if(/<(rss|feed)\b/i.test(html)){
  for(const item of html.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)){
   const value=item[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1');
   const title=value.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';
   const link=value.match(/<link\b[^>]*href=["']([^"']+)/i)?.[1]||value.match(/<link\b[^>]*>([^<]+)<\/link>/i)?.[1]||'';
   const summary=value.match(/<(?:description|summary)\b[^>]*>([\s\S]*?)<\/(?:description|summary)>/i)?.[1]||'';
   if(link)add(title,link,summary);if(leads.length>=12)break;
  }
 }else{
  for(const anchor of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
   if(/sign.?in|register|scoreboard|challenge|privacy|rules|ctftime/i.test(anchor[1]))continue;
   add(anchor[2],anchor[1],'');if(leads.length>=12)break;
  }
 }
 return leads;
}
export function extractStructuredEvents(html:string,sourceUrl:string,checkedAt:string):CTFEvent[]{
 const nodes:Record<string,unknown>[]=[];function visit(value:unknown,depth=0){if(depth>8||nodes.length>=100)return;if(Array.isArray(value)){value.slice(0,100).forEach(v=>visit(v,depth+1));return;}if(value&&typeof value==='object'){const obj=value as Record<string,unknown>;if([obj['@type']].flat().some(t=>t==='Event'||t==='SportsEvent'))nodes.push(obj);if(obj['@graph'])visit(obj['@graph'],depth+1);}}
 for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{visit(JSON.parse(match[1]));}catch{}}
 const results:CTFEvent[]=[];for(const n of nodes){if(typeof n.name!=='string'||!/(ctf|capture.?the.?flag|cyber.*conquest)/i.test(n.name)||typeof n.startDate!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T.*(?:Z|[+-]\d{2}:\d{2}))?$/.test(n.startDate)||!Number.isFinite(Date.parse(n.startDate)))continue;const attendance=String(n.eventAttendanceMode||'');const loc=Array.isArray(n.location)?n.location[0]:n.location;const location=(loc&&typeof loc==='object'?loc:{}) as Record<string,unknown>;const mode=attendance.includes('Mixed')?'Hybrid':attendance.includes('Online')||location['@type']==='VirtualLocation'?'Online':attendance.includes('Offline')||location['@type']==='Place'?'In person':null;if(!mode)continue;
 const officialUrl=typeof n.url==='string'&&isSafeUrl(n.url)&&new URL(n.url).origin===new URL(sourceUrl).origin?n.url:sourceUrl;const organizer=(n.organizer&&typeof n.organizer==='object'?n.organizer:{}) as Record<string,unknown>;const facts:Evidence[]=[{field:'title',value:n.name,url:sourceUrl,checkedAt,kind:'official'},{field:'start',value:n.startDate,url:sourceUrl,checkedAt,kind:'official'},{field:'mode',value:mode,url:sourceUrl,checkedAt,kind:'official'}];
 const end=typeof n.endDate==='string'&&Number.isFinite(Date.parse(n.endDate))?n.endDate:null;if(end)facts.push({field:'end',value:end,url:sourceUrl,checkedAt,kind:'official'});
 results.push({id:'discovered-'+crypto.randomUUID(),title:n.name.slice(0,150),organizer:typeof organizer.name==='string'?organizer.name.slice(0,150):new URL(sourceUrl).hostname,summary:typeof n.description==='string'?fingerprintText(n.description).slice(0,1500):'Discovered on the organizer’s page. A reviewer needs to complete the event details.',mode,format:'Not announced',country:mode==='Online'?'Worldwide':'Not announced',venue:typeof location.name==='string'?location.name.slice(0,250):mode==='Online'?'Online':'Not announced',start:n.startDate,end,dateOnly:!n.startDate.includes('T'),timezone:'UTC',officialUrl,registrationUrl:null,registration:'Not announced',deadline:null,teamSize:null,cost:null,prizes:null,eligibility:'See the organizer’s rules',skill:'Not announced',categories:[],verification:'review',checkedAt,evidence:facts,notes:['Automatically extracted from structured event data. Human review required.','Times retain the offset supplied by the source. The organizer’s named timezone needs review.'],accent:'lime',mark:'flag',cancelled:String(n.eventStatus||'').includes('Cancelled')});}return results;
}
export function extractOfficialPage(html:string,sourceUrl:string,checkedAt:string):CTFEvent[]{
 const structured=extractStructuredEvents(html,sourceUrl,checkedAt);if(structured.length)return structured;
 const text=fingerprintText(html),host=new URL(sourceUrl).hostname;let title='',start='',end='',mode:CTFEvent['mode']='Online',format='Not announced',organizer='',venue='Online',country='Worldwide';
 if(host==='sunshinectf.org'){const name=text.match(/SunshineCTF\s+(20\d{2})/),s=text.match(/Start\s+(20\d{2}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+UTC/i),f=text.match(/Finish\s+(20\d{2}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+UTC/i);if(!name||!s||!f)return [];title=name[0];start=`${s[1]}T${s[2]}:00Z`;end=`${f[1]}T${f[2]}:00Z`;organizer='SunshineCTF';format=/Jeopardy/i.test(text)?'Jeopardy':'Not announced';if(/in.person/i.test(text)&&/Orlando/i.test(text)){mode='Hybrid';country='United States';venue='Orlando, Florida';}}
 else if(/^20\d{2}\.faustctf\.net$/.test(host)){const name=text.match(/FAUST CTF\s+(20\d{2})/),date=text.match(/decryption password will be released at\s+(20\d{2}-\d{2}-\d{2})/i),time=text.match(/actual competition will start at\s+(\d{2}:\d{2})\s+UTC and run for\s+(\w+)\s+hours/i);if(!name||!date||!time)return [];const hours:Record<string,number>={six:6,seven:7,eight:8,nine:9,ten:10,twelve:12};const duration=hours[time[2].toLowerCase()]||Number(time[2]);if(!Number.isFinite(duration)||duration<1||duration>48)return [];title=name[0];start=`${date[1]}T${time[1]}:00Z`;end=new Date(Date.parse(start)+duration*3600000).toISOString();organizer='FAUST';format='Attack-defense';}
 else if(host==='hack.lu'||host==='2026.hack.lu'){
  const when=text.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(20\d{2})\s+starting at\s+(\d{2}:\d{2})\s+UTC\s+\(for\s+(\d+)h\)/i);
  if(!when||!/participate remotely/i.test(text))return [];
  const month=monthNumber(when[2]);title=`hack.lu CTF ${when[3]}`;organizer='FluxFingers';start=`${when[3]}-${month}-${when[1].padStart(2,'0')}T${when[4]}:00Z`;end=new Date(Date.parse(start)+Number(when[5])*3600000).toISOString();
 }
 else if(host==='www.thecatch.cz'||host==='thecatch.cz'){
  const when=text.match(/start on\s+(20\d{2}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+UTC/i),finish=text.match(/competition will be closed on\s+\w+\s+(\d{1,2})\s+(\w+)\s+(20\d{2})\s+at\s+(\d{2}:\d{2})\s+UTC/i);
  if(!when||!finish||!monthNumber(finish[2]))return [];
  title=`The Catch ${when[1].slice(0,4)}`;organizer='CESNET';start=`${when[1]}T${when[2]}:00Z`;end=`${finish[3]}-${monthNumber(finish[2])}-${finish[1].padStart(2,'0')}T${finish[4]}:00Z`;
 }
 else if(host==='pctf.competitivecyber.club'){
  const year=text.match(/PatriotCTF\s+(20\d{2})/),when=text.match(/Virtual\s*[—–-]\s*(\w+)\s+(\d{1,2})\s*@\s*(\d{1,2}):(\d{2})(am|pm)\s+EST\s+to\s+(\w+)\s+(\d{1,2})\s*@\s*(\d{1,2}):(\d{2})(am|pm)\s+EST/i);
  if(!year||!when||!monthNumber(when[1])||!monthNumber(when[6]))return [];
  const hour=(h:string,ap:string)=>String(Number(h)%12+(ap.toLowerCase()==='pm'?12:0)).padStart(2,'0');
  title=`PatriotCTF ${year[1]}`;organizer='MasonCC · George Mason University';start=new Date(`${year[1]}-${monthNumber(when[1])}-${when[2].padStart(2,'0')}T${hour(when[3],when[5])}:${when[4]}:00-05:00`).toISOString();end=new Date(`${year[1]}-${monthNumber(when[6])}-${when[7].padStart(2,'0')}T${hour(when[8],when[10])}:${when[9]}:00-05:00`).toISOString();
 }
 else if(host==='felicity.iiit.ac.in'&&new URL(sourceUrl).pathname==='/infinium/events/deccan-ctf'){
  const when=text.match(/(\d{1,2})\s+(\w+)\s+(20\d{2}),\s*(\d{1,2}):(\d{2})\s*(am|pm)\s*[–—-]\s*(\d{1,2})\s+(\w+)\s+(20\d{2}),\s*(\d{1,2}):(\d{2})\s*(am|pm)\s+IST/i);
  if(!when||!monthNumber(when[2])||!monthNumber(when[8])||!/offline.*jeopardy/i.test(text)||!/Deccan CTF/i.test(text))return [];
  const hour=(h:string,ap:string)=>String(Number(h)%12+(ap.toLowerCase()==='pm'?12:0)).padStart(2,'0');
  title=`Deccan CTF ${when[3]}`;organizer='0x1337 Hacking Club · IIIT Hyderabad';mode='In person';country='India';venue='IIIT Hyderabad';format='Jeopardy';
  start=new Date(`${when[3]}-${monthNumber(when[2])}-${when[1].padStart(2,'0')}T${hour(when[4],when[6])}:${when[5]}:00+05:30`).toISOString();
  end=new Date(`${when[9]}-${monthNumber(when[8])}-${when[7].padStart(2,'0')}T${hour(when[10],when[12])}:${when[11]}:00+05:30`).toISOString();
 }
 else return [];
 if(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.parse(start))return [];
 const fields={title,start,end,mode,format};const evidence:Evidence[]=Object.entries(fields).map(([field,value])=>({field,value,url:sourceUrl,kind:'official',checkedAt}));
 return [{id:'discovered-'+crypto.randomUUID(),title,organizer,summary:`${title} is a capture-the-flag event. Check the official rules before registering.`,mode,format,country,venue,start,end,dateOnly:false,timezone:'UTC',officialUrl:sourceUrl,registrationUrl:null,registration:/registration is now open|Register Now/i.test(text)?'Open':'Not announced',deadline:null,teamSize:null,cost:null,prizes:null,eligibility:'See the organizer’s rules',skill:'Not announced',categories:[],verification:'review',checkedAt,evidence,notes:['Extracted from labeled schedule fields on the official organizer page.'],accent:host==='sunshinectf.org'?'amber':'purple',mark:host==='sunshinectf.org'?'sun':'flag',cancelled:/(?:competition|event|ctf)\s+(?:has been|is)\s+cancelled/i.test(text)}];
}
function monthNumber(name:string){const index=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(name.slice(0,3).toLowerCase());return index<0?'':String(index+1).padStart(2,'0');}
