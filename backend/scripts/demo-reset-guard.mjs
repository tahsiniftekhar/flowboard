// Guard for reset-demo.sh: exits non-zero unless the reset is explicitly allowed and every
// database URL the reset uses points at the demo database, so a wrong URL never wipes another
// database.
import { config } from 'dotenv';

config({ quiet: true });

const ALLOWED_DATABASES = ['flowboard'];

function refuse(reason) {
  console.error(`Refusing demo reset: ${reason}`);
  process.exit(1);
}

function databaseName(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.slice(1));
  } catch {
    return '';
  }
}

if (process.env.DEMO_RESET_ALLOWED !== 'true') {
  refuse('DEMO_RESET_ALLOWED is not "true".');
}

// Prisma migrations use DIRECT_URL when set, the seed uses DATABASE_URL: both must be safe.
for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
  const url = process.env[key];
  if (!url) continue;
  const name = databaseName(url);
  if (!ALLOWED_DATABASES.includes(name)) {
    refuse(
      `${key} targets database "${name}", allowed: ${ALLOWED_DATABASES.join(', ')}.`,
    );
  }
}
