-- user_account Table
-- Stores information about users
CREATE TABLE user_account (
    username VARCHAR(255) PRIMARY KEY,    -- Unique identifier for the user
    email VARCHAR(255) UNIQUE NOT NULL,   -- User's email address, must be unique
    password VARCHAR(255) NOT NULL        -- User's password, cannot be null
);

-- attempt Table
-- Stores information about each attempt made by a user
CREATE TABLE attempt (
    id SERIAL PRIMARY KEY,                  -- Auto-incrementing unique identifier for the attempt
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Time of the attempt, defaults to current time
    compressing_prompt TEXT,                -- The prompt used for compression
    model VARCHAR(255),                     -- The model used in this attempt
    username VARCHAR(255) NOT NULL,         -- The username of the user who made the attempt
    CONSTRAINT fk_user_account              -- Foreign key constraint definition
        FOREIGN KEY(username)               -- Column in this table that is the foreign key
        REFERENCES user_account(username)   -- References the "username" column in the "user_account" table
        ON DELETE CASCADE                   -- If a user is deleted, their attempts are also deleted
);

-- test Table
-- Stores information about different tests
CREATE TABLE test (
    id SERIAL PRIMARY KEY,      -- Auto-incrementing unique identifier for the test
    model VARCHAR(255),         -- The model associated with the test
    payload TEXT                -- The data or content of the test
);

-- test_result Table
-- Junction table linking attempt and test, storing results of tests within attempts
CREATE TABLE test_result (
    attempt_id INTEGER NOT NULL,        -- Foreign key referencing the attempt table
    test_id INTEGER NOT NULL,           -- Foreign key referencing the test table
    is_valid BOOLEAN,                   -- Indicates if the test result is valid
    compressed_prompt TEXT,             -- The compression prompt for this specific test result
    compression_ratio FLOAT,            -- The compression ratio achieved
    PRIMARY KEY (attempt_id, test_id),  -- Composite primary key
    CONSTRAINT fk_attempt               -- Foreign key constraint for attempt_id
        FOREIGN KEY(attempt_id)
        REFERENCES attempt(id)
        ON DELETE CASCADE,              -- If an attempt is deleted, its test results are also deleted
    CONSTRAINT fk_test                  -- Foreign key constraint for test_id
        FOREIGN KEY(test_id)
        REFERENCES test(id)
        ON DELETE CASCADE               -- If a test is deleted, its results are also deleted
);