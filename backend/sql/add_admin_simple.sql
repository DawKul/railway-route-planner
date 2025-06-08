-- Najpierw usuńmy istniejącego admina (jeśli istnieje)
DELETE FROM users WHERE username = 'admin';

-- Dodajmy nowego admina
INSERT INTO users (username, password_hash, role) 
VALUES ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin');

-- Sprawdźmy czy został dodany
SELECT username, role FROM users WHERE username = 'admin'; 