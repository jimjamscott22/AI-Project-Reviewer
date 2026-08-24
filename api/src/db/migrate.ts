import { readFileSync, readdirSync } from 'node:fs';
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

  await admin.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         VARCHAR(128) PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await admin.query('INSERT IGNORE INTO schema_migrations (id) VALUES (?)', ['001-base-schema']);

  const migrationsDir = fileURLToPath(new URL('./migrations/', import.meta.url));
  const migrations = readdirSync(migrationsDir)
    .filter((name) => /^\d{3}-.+\.sql$/.test(name))
    .sort();
  const [appliedRows] = await admin.query<mysql.RowDataPacket[]>('SELECT id FROM schema_migrations');
  const applied = new Set(appliedRows.map((row) => String(row.id)));

  for (const migration of migrations) {
    const migrationId = migration.replace(/\.sql$/, '');
    if (applied.has(migrationId)) continue;

    const sql = readFileSync(fileURLToPath(new URL(`./migrations/${migration}`, import.meta.url)), 'utf8');
    await admin.query(sql);
    await admin.query('INSERT INTO schema_migrations (id) VALUES (?)', [migrationId]);
    console.log(`Applied migration ${migrationId}.`);
  }

  console.log(`Migrated schema into database "${config.db.database}".`);
  await admin.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
