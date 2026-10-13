import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {socialPlatform,isSocialPermalink,socialLeads,sourceStatus,isAnnouncementLead} from '../scripts/social-discovery.mjs';
import {isSafeUrl} from '../.test-runtime/lib/events.mjs';
import {createRobotsGuard} from '../scripts/source-policy.mjs';

test('social discovery accepts exact platform hosts and actual post permalinks',()=>{
  for(const [url,platform] of [['https://www.instagram.com/p/abc_123/','instagram'],['https://x.com/organizer/status/123','x'],['https://www.facebook.com/organizer/posts/123','facebook']]){assert.equal(socialPlatform(url),platform);assert.ok(isSocialPermalink(url));}
  for(const url of ['http://x.com/team/status/1','https://x.com.evil.example/team/status/1','https://user:pass@x.com/team/status/1','https://x.com/team','https://www.instagram.com/accounts/login/','https://www.facebook.com/login'])assert.equal(isSocialPermalink(url),false,url);
});
test('social post dates and claimed verification never become event facts',()=>{
  const post={url:'https://x.com/team/status/123',text:'Campus CTF 2026 registration is open. Join our cybersecurity competition.',links:['https://127.0.0.1/','https://ctf.example/2026'],publishedAt:'2026-10-12T08:00:00Z',start:'2026-10-13T12:00:00Z',verification:'official'};
  const leads=socialLeads({posts:[post]},{platform:'x'},'2026-10-13T10:00:00Z',isSafeUrl);
  assert.equal(leads.length,1);assert.equal(leads[0].officialUrl,'https://ctf.example/2026');assert.equal(leads[0].announcementUrl,post.url);assert.equal(leads[0].publishedAt,post.publishedAt);assert.equal('start' in leads[0],false);assert.equal('verification' in leads[0],false);
  for(const publishedAt of ['2026-10-14T00:00:00Z','2025-01-01T00:00:00Z','bad'])assert.equal(socialLeads({posts:[{...post,publishedAt}]},{platform:'x'},'2026-10-13T10:00:00Z',isSafeUrl).length,0);
});
test('profile biographies and unrelated posts cannot create event leads',()=>{
  for(const post of [{url:'https://www.instagram.com/team/',text:'CTF competition registration is open',links:[]},{url:'https://x.com/team/status/1',text:'Read our CTF challenge writeup',links:[]}])assert.deepEqual(socialLeads({posts:[post]},{platform:socialPlatform(post.url)},'2026-10-13T10:00:00Z',isSafeUrl),[]);
});
test('access failures remain distinguishable from readable source checks',()=>{
  assert.equal(sourceStatus('Error: HTTP 403'),'access-restricted');assert.equal(sourceStatus('HTTP 429'),'access-restricted');assert.equal(sourceStatus('HTTP 301'),'redirect-review');assert.equal(sourceStatus('HTTP 404'),'not-found');assert.equal(sourceStatus('DNS unavailable'),'unavailable');
});
test('robots failures remain closed and are cached across social profiles',async()=>{
  let calls=0;
  const allowed=createRobotsGuard(async()=>{calls++;throw Error('HTTP 403');},()=>true);
  await assert.rejects(allowed('https://x.com/team1'),/403/);
  await assert.rejects(allowed('https://x.com/team2'),/403/);
  assert.equal(calls,1);
});
test('a missing robots file is distinct from a blocked file',async()=>{
  const allowed=createRobotsGuard(async()=>{throw Error('HTTP 404');},rules=>rules==='');
  assert.ok(await allowed('https://ctf.example/announcement'));
});
test('old writeups and navigation links do not fill the announcement queue',()=>{
  const time='2026-10-13T10:00:00Z',base={officialUrl:'https://ctf.example/announcement'};
  for(const lead of [{...base,title:'hxp 39C3 CTF: folly'},{...base,title:'CTF 2026 writeup'},{...base,title:'Browse CTF Events'},{...base,title:'Announcing CTF',publishedAt:'2025-09-03T00:00:00Z'},{...base,title:'CTF resources',officialUrl:'https://ctf.example/news/tools/'}])assert.equal(isAnnouncementLead(lead,time),false);
  assert.ok(isAnnouncementLead({...base,title:'Registration open: Campus CTF 2026',publishedAt:'2026-10-10T00:00:00Z'},time));
});
test('reviewed registry contains safe unique organizers and all three social platforms',async()=>{
  const registry=JSON.parse(await readFile('data/scraping-sources.json','utf8'));
  assert.ok(registry.organizers.length>=23);assert.equal(new Set(registry.organizers.map(source=>source.url)).size,registry.organizers.length);
  assert.deepEqual(new Set(registry.social.map(source=>source.platform)),new Set(['instagram','x','facebook']));
  for(const source of [...registry.organizers,...registry.communities,...registry.social]){assert.ok(isSafeUrl(source.url));assert.notEqual(new URL(source.url).hostname,'ctftime.org');}
  for(const source of registry.social){assert.equal(socialPlatform(source.url),source.platform);assert.ok(isSafeUrl(source.verifiedFrom));}
});
