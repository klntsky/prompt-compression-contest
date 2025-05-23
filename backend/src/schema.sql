-- user Table
-- Stores information about users
CREATE TABLE user (
    login VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

-- attempt Table
-- Stores information about each attempt made by a user
CREATE TABLE attempt (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    compressing_prompt TEXT NOT NULL,
    model VARCHAR(255) NOT NULL,
    login VARCHAR(255) NOT NULL,
    CONSTRAINT fk_user
        FOREIGN KEY(login)
        REFERENCES user(login)
        ON DELETE CASCADE
);

-- test Table
-- Stores information about different tests
CREATE TABLE test (
    id SERIAL PRIMARY KEY,
    model VARCHAR(255) NOT NULL,
    payload TEXT NOT NULL
);

-- test_result Table
-- Junction table linking attempt and test, storing results of tests within attempts
CREATE TABLE test_result (
    attempt_id INTEGER NOT NULL,
    test_id INTEGER NOT NULL,
    is_valid BOOLEAN,
    compressed_prompt TEXT,
    compression_ratio FLOAT,
    PRIMARY KEY (attempt_id, test_id),
    CONSTRAINT fk_attempt
        FOREIGN KEY(attempt_id)
        REFERENCES attempt(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_test
        FOREIGN KEY(test_id)
        REFERENCES test(id)
        ON DELETE CASCADE
);