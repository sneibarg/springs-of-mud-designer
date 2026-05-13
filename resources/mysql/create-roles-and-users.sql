-- Create roles first
CREATE ROLE IF NOT EXISTS 'app_admin', 'app_user', 'app_reader';

-- Grant privileges to roles
GRANT ALL PRIVILEGES ON `som-designer`.* TO 'app_admin';
GRANT SELECT, INSERT, UPDATE, DELETE ON `som-designer`.* TO 'app_user';
GRANT SELECT ON `som-designer`.* TO 'app_reader';

-- Create users and assign roles
CREATE USER IF NOT EXISTS 'som_admin'@'localhost' IDENTIFIED BY 'S0m@dm1n123';
CREATE USER IF NOT EXISTS 'som_user'@'localhost' IDENTIFIED BY 'UserPassword456!';
CREATE USER IF NOT EXISTS 'som_reader'@'localhost' IDENTIFIED BY 'ReadOnlyPass789!';

GRANT 'app_admin' TO 'som_admin'@'localhost';
GRANT 'app_user' TO 'som_user'@'localhost';
GRANT 'app_reader' TO 'som_reader'@'localhost';

-- Set default role for each user
ALTER USER 'som_admin'@'localhost' DEFAULT ROLE 'app_admin';
ALTER USER 'som_user'@'localhost' DEFAULT ROLE 'app_user';
ALTER USER 'som_reader'@'localhost' DEFAULT ROLE 'app_reader';

FLUSH PRIVILEGES;