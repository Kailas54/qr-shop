import { checkDatabaseConnection, prisma } from '../lib/db';
import { dbErrorFields } from '../lib/redact';

async function main(): Promise<void> {
  try {
    await checkDatabaseConnection();
    console.log('database ok');
  } catch (error) {
    const fields = dbErrorFields(error);
    console.error(`database check failed: ${fields.message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
