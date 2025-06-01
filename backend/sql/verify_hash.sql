-- Pokaż dokładnie hash hasła admina
SELECT 
    username,
    password_hash,
    LENGTH(password_hash) as hash_length,
    role
FROM users 
WHERE username = 'admin'; 