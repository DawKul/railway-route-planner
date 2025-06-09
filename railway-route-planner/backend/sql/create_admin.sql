-- Hasło to 'admin' (zahashowane przez bcrypt)
INSERT INTO users (username, password_hash, role) 
VALUES (
    'admin',
    '$2b$10$hlXntx7of5fmxof5of5fmOIX4.1QcS7czh5YWCJwNqHk3FPnEVR1K',
    'admin'
)
ON CONFLICT (username) 
DO UPDATE SET 
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role;

-- Sprawdź czy admin został dodany
SELECT username, role FROM users WHERE username = 'admin'; 