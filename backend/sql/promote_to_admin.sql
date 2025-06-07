-- Najpierw sprawdź czy użytkownik istnieje
SELECT user_id, username, role FROM users;

-- Nadaj uprawnienia admina (podmień 'dawid' na nazwę użytkownika którą utworzyłeś)
UPDATE users 
SET role = 'admin' 
WHERE username = 'dawid';

-- Sprawdź czy zmiana została wprowadzona
SELECT user_id, username, role FROM users; 