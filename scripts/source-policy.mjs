// Share robots results, including failures, across every profile on a host.
// Restricted social hosts get one robots request per run, not one per profile.
export function createRobotsGuard(fetchText,evaluate) {
  const cache=new Map();
  return async url=>{
    const u=new URL(url);
    if(!cache.has(u.origin))cache.set(u.origin,fetchText(`${u.origin}/robots.txt`,100_000).catch(error=>{
      if(/HTTP 404\b/.test(String(error)))return '';
      throw error;
    }));
    return evaluate(await cache.get(u.origin),u.pathname+u.search);
  };
}
