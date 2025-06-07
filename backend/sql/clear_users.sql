-- Wyczyść tabelę users
TRUNCATE users CASCADE;

-- Zresetuj sekwencję ID
ALTER SEQUENCE users_user_id_seq RESTART WITH 1; 