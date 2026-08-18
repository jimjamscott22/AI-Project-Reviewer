import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from '../config.js';

async function main() {
  const admin = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4`);
  await admin.changeUser({ database: config.db.database });

  const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));
  const schema = readFileSync(schemaPath, 'utf8');
  await admin.query(schema);

  console.log(`Migrated schema into database "${config.db.database}".`);
  await admin.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
