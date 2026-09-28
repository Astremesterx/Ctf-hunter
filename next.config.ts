import type {NextConfig} from 'next';

const securityHeaders=[
 {key:'Content-Security-Policy',value:"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://github.com; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; upgrade-insecure-requests"},
 {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
 {key:'X-Content-Type-Options',value:'nosniff'},
 {key:'X-Frame-Options',value:'DENY'},
 {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=(), usb=()'},
 {key:'Cross-Origin-Opener-Policy',value:'same-origin'},
 {key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains'}
];

const nextConfig:NextConfig={
 poweredByHeader:false,
 async headers(){return [{source:'/(.*)',headers:securityHeaders}]}
};
export default nextConfig;
