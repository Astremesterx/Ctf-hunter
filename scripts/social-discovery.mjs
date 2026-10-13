// Public social documents supply review leads only. They never enter the
// official-event parser or turn a post timestamp into a competition date.
export function socialPlatform(url) {
  try {
    const u=new URL(url),host=u.hostname.replace(/^www\./,'');
    if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')return null;
    return host==='instagram.com'?'instagram':['x.com','twitter.com'].includes(host)?'x':host==='facebook.com'?'facebook':null;
  }catch{return null;}
}
export function isSocialPermalink(url,platform=socialPlatform(url)) {
  if(!platform||socialPlatform(url)!==platform)return false;
  const u=new URL(url),p=u.pathname;
  return platform==='instagram'?/^\/(?:p|reel)\/[\w-]+\/?$/.test(p):platform==='x'?/^\/\w+\/status\/\d+\/?$/.test(p):/^\/(?:[^/]+\/posts\/[^/]+|events\/\d+)\/?$/.test(p)||p==='/permalink.php'&&/^\d+$/.test(u.searchParams.get('story_fbid')||'');
}
export function socialLeads(document,source,checkedAt,isSafeUrl) {
  const leads=[];
  for(const post of (document.posts||[]).slice(0,24)){
    if(typeof post.url!=='string'||typeof post.text!=='string'||!isSafeUrl(post.url)||!isSocialPermalink(post.url,source.platform))continue;
    const text=post.text.replace(/\s+/g,' ').trim();
    if(!/(\bctf\b|ctf\s*20\d{2}|capture[\s_-]*the[\s_-]*flag)/i.test(text)||!/register|registration|join|competi|qualif|finals|prize|開催|报名|соревн/i.test(text))continue;
    const published=post.publishedAt&&Date.parse(post.publishedAt);
    if(post.publishedAt&&(!Number.isFinite(published)||published>Date.parse(checkedAt)||published<Date.parse(checkedAt)-60*86400000))continue;
    const outbound=(post.links||[]).find(link=>typeof link==='string'&&isSafeUrl(link)&&!socialPlatform(link)&&!/(?:^|\.)t\.co$/.test(new URL(link).hostname));
    leads.push({title:text.slice(0,150),officialUrl:outbound||post.url,sourceUrl:post.url,announcementUrl:post.url,channel:source.platform,discoveredAt:checkedAt,...(post.publishedAt?{publishedAt:post.publishedAt}:{}),summary:`Public ${source.platform} announcement. Organizer identity and event details need verification. ${text.slice(0,350)}`});
  }
  return leads;
}
export function sourceStatus(error) {
  const message=String(error);
  if(/HTTP (401|403|429)/.test(message))return 'access-restricted';
  if(/HTTP 30\d/.test(message))return 'redirect-review';
  if(/HTTP 404/.test(message))return 'not-found';
  return 'unavailable';
}
export function isAnnouncementLead(lead,checkedAt) {
  const title=lead.title||'',years=[...title.matchAll(/\b(20\d{2})\b/g)].map(match=>Number(match[1]));
  if(years.length&&Math.max(...years)<new Date(checkedAt).getUTCFullYear())return false;
  if(/write.?up|walkthrough|\bsolutions?\b/i.test(title))return false;
  if(/ctf\s*:/i.test(title)&&!/announce|registration|qualif|finals/i.test(title))return false;
  if(/^(?:ctf|browse ctf events|hiring ctf|what is ctf)$/i.test(title.trim()))return false;
  try{if(/\/(?:host-my-event|solutions|what-is-ctf|ctf-key|news\/tools)\/?$/.test(new URL(lead.officialUrl).pathname))return false;}catch{return false;}
  if(lead.publishedAt){const time=Date.parse(lead.publishedAt),now=Date.parse(checkedAt);if(!Number.isFinite(time)||time>now||now-time>120*86400000)return false;}
  return true;
}
