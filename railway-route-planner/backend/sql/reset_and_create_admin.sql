-- 1. Najpierw wyczyść wszystko
TRUNCATE TABLE users CASCADE;
ALTER SEQUENCE users_user_id_seq RESTART WITH 1;

-- 2. Dodaj admina z pełną diagnostyką
DO $$
DECLARE
    v_user_id integer;
BEGIN
    INSERT INTO users (username, password_hash, role)
    VALUES ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin')
    RETURNING user_id INTO v_user_id;
    
    RAISE NOTICE 'Admin został dodany z ID: %', v_user_id;
END $$;

-- 3. Sprawdź czy admin został dodany
SELECT user_id, username, role, created_at 
FROM users 
WHERE username = 'admin';

-- 4. Sprawdź czy możesz się zalogować z tymi danymi
SELECT user_id, username, role 
FROM users 
WHERE username = 'admin' 
AND password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'; 