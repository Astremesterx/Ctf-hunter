import test from 'node:test';
import assert from 'node:assert/strict';
import {workerEnvironment,validateScraplingResult,mayFollowAnnouncement} from '../scripts/scrapling-client.mjs';

test('crawler process environment excludes repository and application credentials',()=>{
  const env=workerEnvironment({PATH:'bin',SystemRoot:'Windows',GITHUB_TOKEN:'secret',NEXT_PUBLIC_TOKEN:'secret',AWS_SECRET_ACCESS_KEY:'secret',HTTPS_PROXY:'secret',PYTHONPATH:'untrusted'});
  assert.deepEqual(env,{PATH:'bin',SystemRoot:'Windows',PYTHONIOENCODING:'utf-8',PYTHONUTF8:'1'});
});
test('worker protocol rejects oversized HTML and document/source substitution',()=>{
  const url='https://ctf.example/',result={url,html:'<main></main>',links:[],rendered:false,adaptiveUsed:false};
  assert.equal(validateScraplingResult(result,url),result);
  for(const bad of [{...result,url:'https://other.example/'},{...result,html:'x'.repeat(1_500_001)},{...result,links:[{title:'CTF',url:42}]}])assert.throws(()=>validateScraplingResult(bad,url));
});
test('only explicit organizer announcement paths may be followed',()=>{
  const source={url:'https://csaw.io/',followPaths:['/competition/']};
  assert.ok(mayFollowAnnouncement(source,'https://csaw.io/competition/capture-the-flag'));
  for(const url of ['https://evil.example/competition/ctf','https://csaw.io/other/ctf','https://csaw.io/competition/ctf?redirect=x','https://csaw.io/competition/register','https://user:pass@csaw.io/competition/ctf'])assert.equal(mayFollowAnnouncement(source,url),false);
});
