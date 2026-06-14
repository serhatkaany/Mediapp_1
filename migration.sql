-- MediAssist Database Migration
-- Adds necessary columns to the users table for Google login and profile personalization.

ALTER TABLE users 
ADD COLUMN google_id VARCHAR(255) DEFAULT NULL UNIQUE,
ADD COLUMN profile_image LONGTEXT DEFAULT NULL,
ADD COLUMN bio TEXT DEFAULT NULL,
ADD COLUMN birth_date DATE DEFAULT NULL,
ADD COLUMN gender VARCHAR(50) DEFAULT NULL,
ADD COLUMN blood_type VARCHAR(20) DEFAULT NULL,
ADD COLUMN height DECIMAL(5,2) DEFAULT NULL,
ADD COLUMN weight DECIMAL(5,2) DEFAULT NULL;
