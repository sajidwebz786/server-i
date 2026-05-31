const sequelize = require('../src/config/database');
const { env } = require('../src/config/env');

const planRows = [
  { name: '₹999 Plan', oldName: '₹1,000 Plan', base: 999, oldBase: 1000, tax: 125, final: 1124, ads: 15, minutes: 30, monthly: 300, debit: 10, banners: 1 },
  { name: '₹1,999 Plan', oldName: '₹2,000 Plan', base: 1999, oldBase: 2000, tax: 125, final: 2124, ads: 30, minutes: 60, monthly: 500, debit: 16.67, banners: 2 },
  { name: '₹2,999 Plan', oldName: '₹3,000 Plan', base: 2999, oldBase: 3000, tax: 125, final: 3124, ads: 60, minutes: 120, monthly: 700, debit: 23.33, banners: 3 }
];

function qi(name) {
  return sequelize.getQueryInterface().quoteIdentifier(name);
}

async function findTable(candidates) {
  const [tables] = await sequelize.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND lower(table_name) IN (:candidates)
    ORDER BY table_name
  `, { replacements: { candidates: candidates.map((item) => item.toLowerCase()) } });
  return tables[0]?.table_name || null;
}

async function addColumn(table, column, definition) {
  await sequelize.query(`ALTER TABLE ${qi(table)} ADD COLUMN IF NOT EXISTS ${qi(column)} ${definition};`);
}

async function applyPackagesSchema(table) {
  await addColumn(table, 'daily_ads_required', 'INTEGER NOT NULL DEFAULT 0');
  await addColumn(table, 'daily_work_minutes', 'INTEGER NOT NULL DEFAULT 0');
  await addColumn(table, 'monthly_generation_amount', 'NUMERIC(12, 2) NOT NULL DEFAULT 0');
  await addColumn(table, 'daily_debit_amount', 'NUMERIC(12, 2) NOT NULL DEFAULT 0');

  for (const plan of planRows) {
    await sequelize.query(`
      UPDATE ${qi(table)}
      SET
        name = :name,
        base_amount = :base,
        tax_amount = :tax,
        final_amount = :final,
        min_ads_required = :ads,
        daily_ads_required = :ads,
        daily_work_minutes = :minutes,
        monthly_generation_amount = :monthly,
        daily_debit_amount = :debit,
        free_banner_count = :banners,
        status = 'active'
      WHERE name = :name
         OR base_amount = :base
    `, {
      replacements: {
        name: plan.name,
        base: plan.base,
        tax: plan.tax,
        final: plan.final,
        ads: plan.ads,
        minutes: plan.minutes,
        monthly: plan.monthly,
        debit: plan.debit,
        banners: plan.banners
      }
    });
  }

  await sequelize.query(`
    UPDATE ${qi(table)}
    SET status = 'inactive'
    WHERE name IN ('1K Package', '2K Package', '3K Package', '₹1,000 Plan', '₹2,000 Plan', '₹3,000 Plan')
       OR base_amount IN (1000, 2000, 3000);
  `);
}

async function dropOldUserTaskUniqueIndexes(table) {
  const [indexes] = await sequelize.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = :table
      AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
      AND indexdef ILIKE '%user_id%'
      AND indexdef ILIKE '%task_id%'
      AND indexdef NOT ILIKE '%task_date%'
  `, { replacements: { table } });

  for (const index of indexes) {
    await sequelize.query(`DROP INDEX IF EXISTS ${qi(index.indexname)};`);
  }
}

async function applyUserTasksSchema(table) {
  await addColumn(table, 'task_date', 'DATE NOT NULL DEFAULT CURRENT_DATE');
  await dropOldUserTaskUniqueIndexes(table);
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ${qi(`${table}_user_task_date_unique`)}
    ON ${qi(table)} ("user_id", "task_id", "task_date");
  `);
}

async function main() {
  if (!env.dbHost || env.dbHost === 'localhost') {
    console.log('Refusing to run: DB_HOST is not set to a remote database.');
    process.exitCode = 1;
    return;
  }

  await sequelize.authenticate();

  const packagesTable = await findTable(['packages', 'Packages']);
  const userTasksTable = await findTable(['user_tasks', 'UserTasks']);
  const transactionsTable = await findTable(['transactions', 'Transactions']);
  const usersTable = await findTable(['users', 'Users']);

  if (usersTable) await addColumn(usersTable, 'avatar_url', 'VARCHAR(255)');
  if (packagesTable) await applyPackagesSchema(packagesTable);
  if (userTasksTable) await applyUserTasksSchema(userTasksTable);
  if (transactionsTable) await addColumn(transactionsTable, 'reference_date', 'DATE');

  console.log('Ad plan schema migration complete.', {
    usersTable,
    packagesTable,
    userTasksTable,
    transactionsTable
  });
}

main()
  .catch((error) => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
