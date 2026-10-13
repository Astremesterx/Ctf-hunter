import Link from '@/components/site-link';
import {ArrowUpRight, Radio, ShieldCheck, Link2, Clock3} from 'lucide-react';
import {seedEvents} from '@/lib/catalog-data';
import registry from '@/data/scraping-sources.json';
import {sourceHealth} from '@/lib/source-health';

export const dynamic = 'force-static';
export const metadata = {title: 'Sources & coverage', description: 'Inspect SignalCTF’s official sources, daily updates, and public social coverage.'};
const labels:Record<string,string> = {
  checked: 'Public source read', 'robots-blocked': 'Automated access blocked',
  'access-restricted': 'Access restricted', 'login-required': 'Login required',
  'no-public-posts': 'No readable public posts', 'redirect-review': 'Redirect needs review',
  'not-found': 'Page not found', unavailable: 'Source unavailable', 'parser-required': 'Check unavailable',
};
function checkedLabel(url:string) {
  const entry = sourceHealth.sources.find(source => source.url === url);
  return entry ? labels[entry.status] || 'Needs review' : 'First check pending';
}
function checkDate(value:string|null) {
  return value ? new Intl.DateTimeFormat('en-GB', {dateStyle:'medium', timeStyle:'short', timeZone:'UTC'}).format(new Date(value))+' UTC' : 'First sweep pending';
}
export default function SourcesPage() {
  const published = Array.from(new Map(seedEvents.map(event => [event.officialUrl, {name:event.organizer, url:event.officialUrl, events:seedEvents.filter(other => other.officialUrl === event.officialUrl).length}])).values()).sort((a,b) => a.name.localeCompare(b.name));
  const monitored:{url:string;name?:string;region?:string}[] = registry.organizers;
  return <main id="main" className="content-page sources-page">
    <div className="eyebrow"><Radio size={15}/> BEHIND THE RADAR</div>
    <h1>Follow the signal.<br/><em>Inspect the source.</em></h1>
    <p className="page-lead">Official event details are checked roughly every six hours. A broader daily sweep searches organizer announcements, community feeds, and readable public social posts. Each listing links to its organizer and shows when its facts were checked.</p>
    <div className="policy-cards">
      <article><Clock3 size={24}/><h2>Daily discovery</h2><p>Scheduled each day at 00:47 UTC / 06:17 IST. Last completed sweep: <strong>{checkDate(sourceHealth.lastDailyCheck)}</strong>. Scheduled runs can be delayed.</p><p>Last organizer check: {checkDate(sourceHealth.lastOrganizerCheck)}.</p></article>
      <article><ShieldCheck size={24}/><h2>Facts before badges</h2><p>Social posts and community notices enter review. Publishing a checked event requires matching official details; unknown dates, fees, and prizes stay unknown.</p></article>
      <article><Link2 size={24}/><h2>Public social coverage</h2><p>We monitor organizer-linked Instagram, X, and Facebook pages where public posts can be read. Restricted pages are shown below. A registered profile does not mean its feed was accessible.</p><Link className="text-link" href="/submit">Send an announcement <ArrowUpRight size={15}/></Link></article>
    </div>
    <div className="source-intro"><div><h2>{monitored.length} organizer watch sources</h2><p className="muted">Worldwide and regional organizers, alongside the published catalog sources.</p></div><Link className="button secondary" href="/verification">How verification works <ArrowUpRight size={16}/></Link></div>
    <div className="coverage-grid">{monitored.map(source => <article className="coverage-card" key={source.url}>
      <div className="coverage-top"><span>Organizer watch</span><small className="source-channel">{source.region || 'Worldwide'}</small></div>
      <h2>{source.name || new URL(source.url).hostname}</h2><a href={source.url} target="_blank" rel="noopener noreferrer">{new URL(source.url).hostname}<ArrowUpRight size={14}/></a><p>{checkedLabel(source.url)}</p>
    </article>)}</div>
    <section className="prose-section"><h2>Instagram, X & Facebook</h2><p>These profiles were linked from the organizers’ own websites. Public posts are discovery leads, and their publication dates are never used as competition dates. Login walls and access restrictions can prevent automatic collection.</p></section>
    <div className="coverage-grid">{registry.social.map(source => <article className="coverage-card" key={source.url}>
      <div className="coverage-top"><span>{source.platform === 'x' ? 'X' : source.platform === 'instagram' ? 'Instagram' : 'Facebook'}</span><small className="source-channel">Public profile</small></div>
      <h2>{source.name}</h2><a href={source.url} target="_blank" rel="noopener noreferrer">Open organizer profile<ArrowUpRight size={14}/></a><p>{checkedLabel(source.url)}</p><a href={source.verifiedFrom} target="_blank" rel="noopener noreferrer">Organizer reference<ArrowUpRight size={14}/></a>
    </article>)}</div>
    <section className="prose-section"><h2>Community announcements & feeds</h2><p>{registry.communities.length} community pages and {registry.feeds.length} public feeds are included in the daily sweep. Their announcements require official evidence before publication.</p></section>
    <div className="coverage-grid">{[...registry.communities, ...registry.feeds.map(url => ({name:new URL(url).hostname+new URL(url).pathname, url}))].map(source => <article className="coverage-card" key={source.url}>
      <div className="coverage-top"><span>Discovery lead source</span></div><h2>{source.name}</h2><a href={source.url} target="_blank" rel="noopener noreferrer">Open source<ArrowUpRight size={14}/></a><p>{checkedLabel(source.url)}</p>
    </article>)}</div>
    <div className="source-intro"><div><h2>{published.length} published source pages</h2><p className="muted">{seedEvents.length} event records in the current catalog snapshot.</p></div></div>
    <div className="coverage-grid">{published.map(source => <article className="coverage-card" key={source.url}>
      <div className="coverage-top"><span>Published source</span><small className="source-channel">{source.events} {source.events === 1 ? 'event' : 'events'}</small></div><h2>{source.name}</h2><a href={source.url} target="_blank" rel="noopener noreferrer">{new URL(source.url).hostname}<ArrowUpRight size={14}/></a><p>Official evidence is recorded on each event’s detail page.</p>
    </article>)}</div>
    <section className="prose-section"><h2>Fast, reviewable updates</h2><p>Discovery and verification finish before a catalog update is published. New machine-readable listings require two matching official-page checks at least five hours apart. Finished and canceled events leave the active directory automatically.</p><p>No directory can capture every local event or every social post. Browsing uses the published snapshot and never waits for external scraping.</p></section>
  </main>;
}
