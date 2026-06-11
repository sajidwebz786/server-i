const sequelize = require('../src/config/database');
const { env } = require('../src/config/env');

async function main() {
  if (!env.dbHost || env.dbHost === 'localhost') {
    console.log('Refusing to run: DB_HOST is not set to a remote database.');
    console.log('Set DB_HOST/DB_NAME/DB_USER/DB_PASSWORD/DB_SSL in server/.env, then run again.');
    process.exitCode = 1;
    return;
  }

  await sequelize.authenticate();
  const [tables] = await sequelize.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND lower(table_name) = 'users'
    ORDER BY CASE WHEN table_name = 'Users' THEN 0 ELSE 1 END
    LIMIT 1
  `);

  const userTable = tables[0]?.table_name;
  if (!userTable) {
    throw new Error('Could not find a users table in the connected database.');
  }

  const quotedTable = sequelize.getQueryInterface().quoteIdentifier(userTable);
  await sequelize.query(`ALTER TABLE ${quotedTable} ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP;`);

  const [columns] = await sequelize.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = :userTable AND column_name = 'subscriptionExpiresAt'
  `, { replacements: { userTable } });

  if (!columns.length) {
    throw new Error('subscriptionExpiresAt column was not found after migration.');
  }

  console.log(`Migration complete: subscriptionExpiresAt exists on ${userTable} in ${env.dbName}.`);
}

main()
  .catch((error) => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
