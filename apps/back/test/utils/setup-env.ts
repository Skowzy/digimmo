process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgres://digimmo:digimmo@localhost:5432/digimmo_test';
process.env.MONGO_URL =
  process.env.MONGO_URL ?? 'mongodb://localhost:27017/digimmo_test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-0123456789';
process.env.FRONT_ORIGIN = 'http://localhost:5173';
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '1025';
process.env.MAIL_FROM = 'Digimmo <no-reply@digimmo.test>';
