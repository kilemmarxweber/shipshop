SELECT migration_name FROM "_prisma_migrations" WHERE migration_name LIKE '%event%' OR migration_name LIKE '%ticket%';
SELECT to_regclass('public.event') AS event_table;
