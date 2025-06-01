-- Odśwież widok użytkowników
DISCARD ALL;
SELECT user_id, username, role, created_at 
FROM users 
ORDER BY user_id; 