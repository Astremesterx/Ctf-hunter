export type Evidence = { field: string; value: string; url: string; checkedAt: string; kind: 'official' | 'secondary'; excerpt?: string };
export type CTFEvent = {
  id: string; title: string; organizer: string; summary: string; mode: 'Online' | 'In person' | 'Hybrid';
  format: string; country: string; venue: string; start: string; end: string | null; dateOnly?: boolean;
  timezone: string; officialUrl: string; registrationUrl: string | null; registration: 'Open' | 'Closed' | 'Invite only' | 'Not announced';
  deadline: string | null; teamSize: number | null; cost: string | null; prizes: string | null; eligibility: string;
  entryFee?: 'free' | 'paid' | 'unknown'; prizeType?: 'cash' | 'non-cash' | 'mixed' | 'none' | 'unknown';
  skill: string; categories: string[]; verification: 'official' | 'corroborated' | 'review'; checkedAt: string;
  evidence: Evidence[]; notes: string[]; accent: string; mark: string; demo?: boolean; cancelled?: boolean;
};
export const UNKNOWN = 'Not announced';
export function isSafeUrl(value: string) {
  try { const u = new URL(value); const host = u.hostname.replace(/\.$/, ''); return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') && !host.endsWith('.local') && !host.endsWith('.internal') && !host.endsWith('.localhost') && host !== 'localhost' && !/^[\d.]+$/.test(host) && !host.includes(':') && host.includes('.'); } catch { return false; }
}
export function normalizeUrl(value: string) { const url = new URL(value); url.hash = ''; ['utm_source','utm_medium','utm_campaign','ref'].forEach(k => url.searchParams.delete(k)); return url.toString().replace(/\/$/, ''); }
export function eventKey(e: Pick<CTFEvent, 'officialUrl' | 'start' | 'title'>) { return `${normalizeUrl(e.officialUrl)}|${e.start.slice(0,10)}|${e.title.toLowerCase().replace(/[^a-z0-9]/g,'')}`; }
// A changed date must still resolve to the existing edition and its subscribers.
export function sameEdition(a: Pick<CTFEvent,'officialUrl'|'title'>, b: Pick<CTFEvent,'officialUrl'|'title'>) { return normalizeUrl(a.officialUrl) === normalizeUrl(b.officialUrl) && a.title.toLowerCase().replace(/[^a-z0-9]/g,'') === b.title.toLowerCase().replace(/[^a-z0-9]/g,''); }
export function phase(e: CTFEvent, now = Date.now()) { if (e.cancelled) return 'Cancelled'; if(e.dateOnly){const today=new Intl.DateTimeFormat('en-CA',{timeZone:e.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));return today>(e.end||e.start).slice(0,10)?'Ended':'Upcoming';} const end = Date.parse(e.end || e.start); if (end < now) return 'Ended'; if (Date.parse(e.start) <= now) return 'Live now'; return 'Upcoming'; }
export function verificationLabel(e: CTFEvent, now = Date.now()) { if(e.demo) return 'Demo event'; if (e.verification === 'review') return 'Needs review'; if (now - Date.parse(e.checkedAt) > 7*86400000) return 'Recheck due'; return e.verification === 'corroborated' ? 'Sources corroborated' : 'Official source checked'; }
export function canVerify(evidence: Evidence[], criticalFields: string[]) { return criticalFields.length>0&&criticalFields.every(field => evidence.some(e => e.field === field && e.kind === 'official' && e.value.trim() && isSafeUrl(e.url) && Number.isFinite(Date.parse(e.checkedAt)))); }
export function formatDate(value: string, zone = 'UTC', options: Intl.DateTimeFormatOptions = {}) { return new Intl.DateTimeFormat('en-GB', { timeZone: zone, day:'numeric',month:'short', ...options }).format(new Date(value)); }
export function calendarDate(e: CTFEvent, zone: string) { return e.dateOnly ? e.start.slice(0,10) : new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(e.start)); }
const icsEscape = (v: string) => v.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const icsTime = (v: string) => new Date(v).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
function foldLine(line: string) { let result = '', size = 0; for (const char of line) { const n = new TextEncoder().encode(char).length; if(size+n>73) { result+='\r\n '; size=1; } result+=char; size+=n; } return result; }
export function makeICS(events: CTFEvent[], reminder = false) {
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SignalCTF//Event Radar//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for (const e of events) {
    if (e.verification === 'review' || e.demo) continue;
    lines.push('BEGIN:VEVENT',`UID:${e.id}@signalctf`,`DTSTAMP:${icsTime(new Date().toISOString())}`,`SUMMARY:${icsEscape(e.title)}`);
    if(e.dateOnly) {lines.push(`DTSTART;VALUE=DATE:${e.start.slice(0,10).replace(/-/g,'')}`);if(e.end)lines.push(`DTEND;VALUE=DATE:${new Date(Date.parse(e.end.slice(0,10)+'T00:00:00Z')+86400000).toISOString().slice(0,10).replace(/-/g,'')}`);}
    else { lines.push(`DTSTART:${icsTime(e.start)}`); if(e.end) lines.push(`DTEND:${icsTime(e.end)}`); }
    lines.push(`DESCRIPTION:${icsEscape(`${e.summary}\nOfficial page: ${e.officialUrl}\nLast checked: ${e.checkedAt}\nConfirm the schedule with the organizer before attending.`)}`,`URL:${e.officialUrl}`,`LOCATION:${icsEscape(e.mode==='Online'?'Online':e.venue)}`,`STATUS:${e.cancelled?'CANCELLED':'CONFIRMED'}`);
    if(reminder) lines.push('BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY',`DESCRIPTION:${icsEscape(e.title+' starts tomorrow')}`,'END:VALARM');
    lines.push('END:VEVENT');
    if(reminder && e.deadline) lines.push('BEGIN:VEVENT',`UID:${e.id}-deadline@signalctf`,`DTSTAMP:${icsTime(new Date().toISOString())}`,`DTSTART:${icsTime(e.deadline)}`,`SUMMARY:${icsEscape('Registration deadline: '+e.title)}`,'BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY','DESCRIPTION:Registration closes tomorrow','END:VALARM','END:VEVENT');
  }
  return lines.map(foldLine).concat('END:VCALENDAR','').join('\r\n');
}
