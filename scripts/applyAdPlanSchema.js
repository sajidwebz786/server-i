const sequelize = require('../src/config/database');
const { env } = require('../src/config/env');
const { PLAN_CONFIG, planDefaults } = require('../src/utils/plans');

const planRows = PLAN_CONFIG.map((plan) => ({ ...plan, defaults: planDefaults(plan) }));

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
  await addColumn(table, 'earning_per_advertisement', 'NUMERIC(12, 2) NOT NULL DEFAULT 0');
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
        earning_per_advertisement = :earning,
        daily_work_minutes = :minutes,
        monthly_generation_amount = :monthly,
        daily_debit_amount = :debit,
        free_banner_count = :banners,
        status = 'active'
      WHERE name = :name
         OR name = :oldName
         OR base_amount IN (:base, :oldBase)
    `, {
      replacements: {
        name: plan.name,
        oldName: plan.oldName,
        base: plan.baseAmount,
        oldBase: plan.oldName === '₹1,000 Plan' ? 1000 : plan.oldName === '₹2,000 Plan' ? 2000 : 3000,
        tax: plan.defaults.taxAmount,
        final: plan.defaults.finalAmount,
        ads: plan.defaults.dailyAdsRequired,
        earning: plan.defaults.earningPerAdvertisement,
        minutes: plan.defaults.dailyWorkMinutes,
        monthly: plan.defaults.monthlyGenerationAmount,
        debit: plan.defaults.dailyDebitAmount,
        banners: plan.defaults.freeBannerCount
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
  await addColumn(table, 'watch_percent', 'INTEGER NOT NULL DEFAULT 0');
  await addColumn(table, 'watch_seconds', 'INTEGER NOT NULL DEFAULT 0');
  await addColumn(table, 'watched_at', 'TIMESTAMP WITH TIME ZONE');
  await dropOldUserTaskUniqueIndexes(table);
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ${qi(`${table}_user_task_date_unique`)}
    ON ${qi(table)} ("user_id", "task_id", "task_date");
  `);
}

async function applyBankDetailsSchema(table) {
  await addColumn(table, 'aadhaar_number', 'VARCHAR(255)');
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
  const bankDetailsTable = await findTable(['bank_details', 'BankDetails']);
  const withdrawalsTable = await findTable(['withdrawals', 'Withdrawals']);

  if (usersTable) await addColumn(usersTable, 'avatar_url', 'VARCHAR(255)');
  if (packagesTable) await applyPackagesSchema(packagesTable);
  if (userTasksTable) await applyUserTasksSchema(userTasksTable);
  if (transactionsTable) await addColumn(transactionsTable, 'reference_date', 'DATE');
  if (bankDetailsTable) await applyBankDetailsSchema(bankDetailsTable);
  if (withdrawalsTable) {
    await addColumn(withdrawalsTable, 'transaction_number', 'VARCHAR(255)');
    await addColumn(withdrawalsTable, 'timeline', "JSONB NOT NULL DEFAULT '[]'::jsonb");
  }

  console.log('Ad plan schema migration complete.', {
    usersTable,
    packagesTable,
    userTasksTable,
    transactionsTable,
    bankDetailsTable,
    withdrawalsTable
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
