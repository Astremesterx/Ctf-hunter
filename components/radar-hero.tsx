'use client';
import Link from '@/components/site-link';
import {ArrowDown,ArrowUpRight,ShieldCheck,Radio,ScanLine} from 'lucide-react';
import {type CTFEvent,phase,verificationLabel} from '@/lib/events';

export function RadarHero({events,scope}:{events:CTFEvent[];scope:'all'|'saved'|'archive'}) {
  const upcoming=events.filter(e=>phase(e)!=='Ended'&&!e.cancelled);
  const official=events.filter(e=>['Official source checked','Sources corroborated'].includes(verificationLabel(e))).length;
  const review=events.filter(e=>e.verification==='review').length;
  const sources=new Set(events.flatMap(e=>e.evidence.map(s=>new URL(s.url).hostname))).size;
  const first=new Date();first.setUTCHours(0,0,0,0);
  first.setUTCDate(first.getUTCDate()-((first.getUTCDay()+6)%7));
  const weeks=Array.from({length:6},(_,index)=>{
    const start=first.getTime()+index*7*86400000,end=start+7*86400000;
    return {label:new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(start)),count:events.filter(e=>Date.parse(e.start)>=start&&Date.parse(e.start)<end).length};
  });
  const max=Math.max(1,...weeks.map(w=>w.count));
  const spotlight=upcoming.filter(e=>e.verification!=='review'&&!e.dateOnly).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start))[0];
  return <>
    <section className="radar-hero">
      <div className="hero-copy">
        <div className="eyebrow"><span className="status-light"/> GLOBAL CTF DISCOVERY <span className="hero-version">/ 2026</span></div>
        <h1>{scope==='saved'?<>Your flags.<br/><em>Your radar.</em></>:scope==='archive'?<>Every flag has<br/><em>a history.</em></>:<>Find your<br/><em>next flag<span className="hero-period">.</span></em><span className="terminal-cursor" aria-hidden="true">_</span></>}</h1>
        <p>{scope==='saved'?'A personal watchlist for the events and organizers you follow.':scope==='archive'?'Explore past competitions, revisit the sources, and get ready for what comes next.':'The world of capture the flag, on your radar. Find your challenge. Check the intel. Get in the game.'}</p>
        <div className="hero-actions"><a className="button primary" href="#directory">{scope==='saved'?'Open my radar':'Explore the events'}<ArrowDown size={16}/></a><Link href="/verification" className="hero-text-link"><ShieldCheck size={17}/>How we verify<ArrowUpRight size={15}/></Link></div>
        <div className="hero-caption"><span>01 / ONLINE</span><span>02 / IN PERSON</span><span>03 / HYBRID</span></div>
      </div>
      <div className="radar-console">
        <div className="console-bar"><div className="console-dots" aria-hidden="true"><i/><i/><i/></div><span>signalctf / event-radar</span><ScanLine size={14}/></div>
        <div className="console-body">
          <div className="console-title"><span><Radio size={14}/> EVENT ACTIVITY</span><span>UTC · 6 WEEKS</span></div>
          <div className="console-metric"><strong>{String(upcoming.length).padStart(2,'0')}</strong><div><span>upcoming signals</span><small>across {new Set(events.map(e=>e.organizer)).size} organizers</small></div><span className="console-plus" aria-hidden="true">+</span></div>
          <div className="activity-chart" aria-label="Event starts by week">{weeks.map((week,i)=><div className="activity-column" key={week.label}><span className="activity-count">{week.count}</span><div className="activity-track"><div className={i===0?'current':''} style={{height:Math.max(4,week.count/max*100)+'%'}}/></div><span className="activity-label">{week.label}</span></div>)}</div>
          <div className="console-footer"><span><i/> PUBLIC SOURCE SNAPSHOT</span><Link href="/sources">Inspect sources <ArrowUpRight size={13}/></Link></div>
          {spotlight&&<Link className="radar-spotlight" href={'/events/'+spotlight.id}><span><small>NEXT ON THE RADAR</small>{spotlight.title}</span><ArrowUpRight size={17}/></Link>}
        </div>
      </div>
    </section>
    <div className="signal-strip" aria-label="Directory coverage"><span className="strip-title"><ScanLine size={17}/> THE SIGNAL</span><span><strong>{String(events.length).padStart(2,'0')}</strong> events indexed</span><span><strong>{String(official).padStart(2,'0')}</strong> recently checked</span><span className="review-count"><strong>{String(review).padStart(2,'0')}</strong> need review</span><Link href="/sources">{sources} evidence sources<ArrowUpRight size={14}/></Link></div>
  </>;
}
