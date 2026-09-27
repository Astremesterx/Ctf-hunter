const {SITE_ORIGIN,JOB_TOKEN}=process.env;
if(!SITE_ORIGIN||!JOB_TOKEN)throw new Error('Set SITE_ORIGIN and JOB_TOKEN in the scheduler environment.');
const origin=new URL(SITE_ORIGIN);if(origin.protocol!=='https:')throw new Error('SITE_ORIGIN must use HTTPS.');
const response=await fetch(new URL('/api/jobs',origin),{method:'POST',headers:{Authorization:`Bearer ${JOB_TOKEN}`},redirect:'error',signal:AbortSignal.timeout(120000)});
if(!response.ok)throw new Error(`Ingestion failed (${response.status}). Check host access and job credentials.`);
const result=await response.json();console.log(JSON.stringify(result));if(result.sources.some(r=>r.status==='failed'))process.exitCode=1;
