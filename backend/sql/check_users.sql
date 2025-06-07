-- Sprawdź czy tabela users istnieje
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public'
   AND table_name = 'users'
);

-- Pokaż strukturę tabeli users
\d+ users;

-- Pokaż wszystkich użytkowników
SELECT * FROM users; 