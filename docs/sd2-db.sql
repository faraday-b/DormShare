CREATE DATABASE IF NOT EXISTS `sd2-db`;
USE `sd2-db`;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  points INT DEFAULT 50,
  profile_image LONGTEXT,
  report_count INT DEFAULT 0,
  is_banned TINYINT DEFAULT 0,
  is_deleted TINYINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  category_id INT,
  user_id INT,
  points_required INT,
  status VARCHAR(50) DEFAULT 'Available',
  image_data LONGTEXT,
  item_condition VARCHAR(50),
  pickup_location VARCHAR(100),
  availability_notes TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS borrow_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  borrower_id INT NOT NULL,
  lender_id INT NOT NULL,
  status VARCHAR(50) DEFAULT 'Requested',
  points_cost INT NOT NULL,
  return_condition VARCHAR(50),
  return_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id),
  FOREIGN KEY (borrower_id) REFERENCES users(id),
  FOREIGN KEY (lender_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  item_id INT,
  message_text TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reporter_id INT NOT NULL,
  reported_user_id INT NOT NULL,
  item_id INT,
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'Open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(id),
  FOREIGN KEY (reported_user_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reviewer_id INT NOT NULL,
  reviewed_user_id INT NOT NULL,
  item_id INT,
  rating INT NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reviewer_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_user_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES items(id)
);

INSERT INTO users (username, email, password_hash, points) VALUES
('j_doe23', 'j.doe@roehampton.ac.uk', 'password123', 75),
('amiller_sd', 'a.miller@roehampton.ac.uk', 'password123', 120),
('sam_lee99', 's.lee@roehampton.ac.uk', 'password123', 50),
('h_wilson', 'h.wilson@roehampton.ac.uk', 'password123', 200),
('robert_p', 'r.patel@roehampton.ac.uk', 'password123', 85);

INSERT INTO categories (name) VALUES
('Electronics'),
('Kitchen'),
('Study'),
('Clothing'),
('Furniture'),
('Books'),
('Cleaning'),
('Sports'),
('Other');

INSERT INTO items (title, description, category_id, user_id, points_required, status, item_condition, pickup_location, availability_notes) VALUES
('Laptop Charger', 'Dell charger for laptops', 1, 1, 10, 'Available', 'Good', 'Library', 'Available most weekdays.'),
('Blender', 'Kitchen blender in good condition', 2, 2, 15, 'Available', 'Good', 'Student kitchen', 'Please return clean.'),
('Textbook: Data Structures', 'Useful for CS students', 3, 3, 8, 'Available', 'Good', 'Library', 'Can lend for one week.'),
('Suit for Interview', 'Formal wear for interviews', 4, 4, 20, 'Available', 'Good', 'Accommodation reception', 'Best for interview days or presentations.');
