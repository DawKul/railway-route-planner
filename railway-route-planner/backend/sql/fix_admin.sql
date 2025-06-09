-- 1. Usuń wszystkie dane z tabeli
TRUNCATE users CASCADE;

-- 2. Zresetuj sekwencję ID
ALTER SEQUENCE users_user_id_seq RESTART WITH 1;

-- 3. Dodaj admina z poprawnym hashem dla hasła 'admin'
INSERT INTO users (username, password_hash, role)
VALUES (
    'admin',
    '$2b$10$rMqPdv5Cqtj6N5UDNjLwXOsXwXqhVS5igZwKvNf9z.ZTNS0oF.J5.',
    'admin'
);

-- 4. Sprawdź czy admin został dodany
SELECT * FROM users;

-- 5. Sprawdź czy możesz wyszukać admina
SELECT * FROM users WHERE username = 'admin';

-- 6. Pokaż dokładne uprawnienia do tabeli
SELECT * FROM information_schema.table_privileges WHERE table_name = 'users'; 