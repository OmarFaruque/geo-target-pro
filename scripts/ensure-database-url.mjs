import fs from 'fs';
import path from 'path';

if (!process.env.DATABASE_URL) {
  for (const envFile of ['.env', '.env.local']) {
    try {
      const envPath = path.resolve(process.cwd(), envFile);
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/^DATABASE_URL=["']?(.*?)["']?$/m);
        if (match && match[1]) {
          process.env.DATABASE_URL = match[1].trim();
          break;
        }
      }
    } catch (e) {
      // ignore errors
    }
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error(`\nDATABASE_URL is not set.\n\nThis Shopify app uses Prisma with PostgreSQL for session storage, so Prisma cannot run migrations until DATABASE_URL points to a PostgreSQL database.\n\nLocal development:\n  1. Copy .env.example to .env\n  2. Set DATABASE_URL to your local or hosted PostgreSQL connection string\n  3. Run npm run setup\n  4. Run shopify app dev\n\nProduction/public app:\n  Set DATABASE_URL in your hosting provider's environment variables before deploying. Do not use SQLite for a public multi-store app.\n`);
    process.exit(1);
}