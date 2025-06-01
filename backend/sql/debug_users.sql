-- Sprawdź dokładnie zawartość tabeli users
SELECT 
    user_id,
    username,
    LENGTH(password_hash) as hash_length,
    SUBSTRING(password_hash, 1, 10) as hash_start,
    role,
    created_at,
    pg_size_pretty(pg_column_size(password_hash)) as hash_size
FROM users;

-- Sprawdź uprawnienia użytkownika
SELECT current_user, session_user;

-- Sprawdź czy tabela nie jest uszkodzona
ANALYZE VERBOSE users; 