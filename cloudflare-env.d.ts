declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ADMIN_EMAILS?: string;
    ADMIN_SETUP_TOKEN?: string;
    JOB_TOKEN?: string;
    SITE_ORIGIN?: string;
  }
}
