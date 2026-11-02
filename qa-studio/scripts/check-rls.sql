-- Run in Supabase › SQL Editor after every deploy that adds tables: every row should say true.
SELECT tablename, rowsecurity AS rls_on FROM pg_tables WHERE schemaname = 'public' ORDER BY rowsecurity, tablename;
