-- Usuń wszystkie dane
TRUNCATE users CASCADE;

-- Zresetuj sekwencję
ALTER SEQUENCE users_user_id_seq RESTART WITH 1;

-- Dodaj admina z gwarantowanie działającym hashem dla hasła 'admin'
INSERT INTO users (username, password_hash, role)
VALUES (
    'admin',
    '$2b$10$zxv0Z5dUV3fGxkN4OkJEG.Qz4LZ0367OD.7GgxbvehH3rqVX0azAa',
    'admin'
);

-- Potwierdź że admin został dodany
SELECT user_id, username, role FROM users; 