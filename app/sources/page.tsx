import Link from '@/components/site-link';
import {ArrowUpRight,Radio,ShieldCheck,Link2} from 'lucide-react';
import {sourceCoverage} from '@/lib/store';
export const dynamic='force-dynamic';
export const metadata={title:'Sources & coverage',description:'Inspect SignalCTF’s official sources, public social leads, and the status of automated checks.'};
export default async function SourcesPage(){
 let sources:Awaited<ReturnType<typeof sourceCoverage>>=[];
 let error=false;
 try{sources=await sourceCoverage();}catch{error=true;}
 const enabled=sources.filter(s=>s.approved).length;
 const channel=(url:string)=>{const host=new URL(url).hostname;return host.includes('instagram.com')?'Instagram':host.includes('linkedin.com')?'LinkedIn':host.includes('infosec.exchange')?'Mastodon':host.includes('reddit.com')?'Community':'Event website';};
 return <main id="main" className="content-page sources-page">
  <div className="eyebrow"><Radio size={15}/> BEHIND THE RADAR</div>
  <h1>Follow the signal.<br/><em>Inspect the source.</em></h1>
  <p className="page-lead">Official event pages, university communities, public announcements, and organizer submissions. A growing view of CTFs around the world, with honest coverage and visible checks.</p>
  <div className="policy-cards"><article><ShieldCheck size={24}/><h2>Facts before badges</h2><p>Structured schedules and supported official pages can confirm existing events. New events, conflicting dates, and social leads go to review before verification.</p></article><article><Link2 size={24}/><h2>Public social signals</h2><p>Share a public Instagram, LinkedIn, Mastodon, or community post. A reviewer checks its organizer and official registration page. Login-only or inaccessible posts are never treated as verified evidence.</p><Link className="text-link" href="/submit">Send an announcement <ArrowUpRight size={15}/></Link></article></div>
  <div className="source-intro"><div><h2>{sources.length} sources in the registry</h2><p className="muted">{enabled} enabled for automatic checks · {sources.length-enabled} awaiting access or source review</p></div><Link className="button secondary" href="/verification">How verification works <ArrowUpRight size={16}/></Link></div>
  <p className="form-note" style={{marginBottom:20}}>Enabled sources are checked when due after site visits, at most once every six hours. Source fetches and event verification are separate: fetching a page does not automatically verify its contents.</p>
  {error?<div className="coverage-empty" role="status">Source status is temporarily unavailable. Event pages still show their recorded evidence.</div>:<div className="coverage-grid">{sources.map(s=><article className="coverage-card" key={s.id}><div className="coverage-top"><span className={s.approved?'':'paused'}>{s.approved?'Checks enabled':'Paused / review'}</span><small className="source-channel">{channel(s.url)}</small></div><h2>{s.name}</h2><a href={s.url} target="_blank" rel="noopener noreferrer">{new URL(s.url).hostname}<ArrowUpRight size={14}/></a><p>{s.status}</p><small>{s.lastSuccess?`Page last fetched ${new Date(s.lastSuccess).toLocaleString('en-GB',{timeZone:'UTC'})} UTC`:'No successful automatic fetch recorded'}</small></article>)}</div>}
  <section className="prose-section"><h2>Coverage you can understand</h2><p>No directory can guarantee every CTF. Some organizers publish only inside private communities, social feeds, or image posters. Our current Instagram sources are paused because the posts could not be accessed. Public post links can still be submitted as leads; they need official corroboration.</p><p>Approved sources support structured event data, selected official schedule formats, and RSS or Atom announcement feeds. Robots restrictions, redirects, inaccessible pages, and fetch failures remain visible in the review dashboard.</p></section>
 </main>;
}
