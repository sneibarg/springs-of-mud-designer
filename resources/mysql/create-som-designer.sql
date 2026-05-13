-- 1. Create the database
CREATE DATABASE IF NOT EXISTS `som-designer`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- 2. Use the new database
USE `som-designer`;

-- 3. Create Roles table (recommended for better normalization)
CREATE TABLE IF NOT EXISTS `roles` (
                                       `role_id`   INT AUTO_INCREMENT PRIMARY KEY,
                                       `role_name` VARCHAR(50) NOT NULL UNIQUE,
    `description` VARCHAR(255) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;

-- 4. Create Accounts table with foreign key to roles
CREATE TABLE IF NOT EXISTS `accounts` (
                                          `account_id` INT AUTO_INCREMENT PRIMARY KEY,
                                          `username`   VARCHAR(50)  NOT NULL UNIQUE,
    `email`      VARCHAR(100) NOT NULL UNIQUE,
    `password`   VARCHAR(255) NOT NULL,           -- increased length for hashed passwords
    `role_id`    INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (`role_id`) REFERENCES `roles`(`role_id`)
                                                     ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB;

-- 5. Insert default roles
INSERT INTO `roles` (`role_name`, `description`) VALUES
                                                     ('ADMIN', 'System administrator with full access'),
                                                     ('USER',  'Regular user'),
                                                     ('EDITOR', 'Can create and edit content')
    ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- 6. (Optional) Create a sample admin account
-- IMPORTANT: Never store plain-text passwords in production!
INSERT INTO `accounts` (`username`, `email`, `password`, `role_id`)
SELECT 'admin', 'admin@som-designer.com', '$2a$12$examplehashedpasswordhere1234567890', r.role_id
FROM `roles` r
WHERE r.role_name = 'ADMIN'
    ON DUPLICATE KEY UPDATE `username` = `username`;