-- 1. Sprawdź dokładnie strukturę tabeli
\d+ users;

-- 2. Pokaż WSZYSTKIE kolumny z tabeli users
SELECT user_id, username, password_hash, role, created_at 
FROM users 
ORDER BY user_id;

-- 3. Sprawdź czy są jakieś rekordy w ogóle
SELECT COUNT(*) as total_users FROM users;

-- 4. Spróbuj ponownie dodać admina z pełną diagnostyką
INSERT INTO users (username, password_hash, role) 
VALUES ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin')
ON CONFLICT (username) 
DO NOTHING
RETURNING user_id, username, role;

-- 5. Sprawdź uprawnienia do tabeli
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'users';

-- 6. Sprawdź czy nie ma problemów z sekwencją
SELECT last_value, is_called FROM users_user_id_seq; 