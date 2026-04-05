-- Base64 data URLs far exceed VARCHAR(255); full payload must be stored for cross-device sync
ALTER TABLE users
  ALTER COLUMN profile_picture TYPE TEXT;
