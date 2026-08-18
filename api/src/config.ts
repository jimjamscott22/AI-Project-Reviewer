import 'dotenv/config';

function required(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(required('PORT', '8080')),
  corsOrigin: required('CORS_ORIGIN', 'http://localhost:5173'),
  db: {
    host: required('DB_HOST', 'localhost'),
    port: Number(required('DB_PORT', '3306')),
    user: required('DB_USER', 'apr'),
    password: required('DB_PASSWORD', 'apr'),
    database: required('DB_NAME', 'apr'),
  },
};
