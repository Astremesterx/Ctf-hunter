'use client';
export default function Error({reset}:{reset:()=>void}){return <main id="main" className="content-page compact"><div className="eyebrow">CONNECTION INTERRUPTED</div><h1>The signal dropped.</h1><p>We couldn’t load this page. Please try again.</p><button className="button primary" onClick={reset}>Try again</button></main>;}
