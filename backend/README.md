### Test Auth

1. Register a User: POST /user-accounts with username, email, password. (Password will be hashed).
2. Login: POST /auth/login with the same username and password (plain text). You should receive an access_token.
3. Access Protected Route: GET /auth/profile with an Authorization header set to Bearer <your_access_token>. You should get the user profile. Try without the token or with an invalid token to see it fail.

### Admin

Now, the POST /tests endpoint for creating tests is protected. Only users who are authenticated (valid JWT) AND have the UserRole.ADMIN in their roles array (which comes from their UserAccount record and is included in the JWT) will be able to create a test.

**How to make a user an admin?**

You would need to manually update a user's record in the database to include 'admin' in their roles array. For example, using psql:
```UPDATE user_account SET roles = '{user,admin}' WHERE username = 'some_admin_user';```
(Arrays in PostgreSQL are often represented with curly braces in SQL literals).
Or, you could build an admin interface or a CLI command later to manage user roles.

### Testing the full authentication and authorization flow

1. Register user (gets ['user'] role by default).
2. Try to create a test (should fail).
3. Manually update user to have ['user', 'admin'] roles in DB.
4. Login as this admin user to get a new JWT (which will now include 'admin' role).
5. Try to create a test again (should succeed).

### Summary of protections applied

Okay, here's a consolidated list of the protections applied to the various controllers and their endpoints throughout our session:

**1. `AttemptController` (`/attempts`)**

*   **`POST /` (Create Attempt):**
    *   Protected by: `@UseGuards(JwtAuthGuard)`
    *   Logic: Requires a logged-in user. The `username` from the JWT payload (`req.user.username`) is automatically associated with the created attempt.
*   **`GET /` (Find All Attempts):**
    *   Protected by: `@UseGuards(JwtAuthGuard)`
    *   Logic:
        *   If the logged-in user is an `ADMIN`, all attempts are returned.
        *   Otherwise, only attempts where `attempt.username` matches `req.user.username` are returned.
*   **`GET /:id` (Find One Attempt):**
    *   Protected by: `@UseGuards(JwtAuthGuard)`
    *   Logic:
        *   If the logged-in user is an `ADMIN`, the attempt is returned if found.
        *   Otherwise, the attempt is returned only if found AND `attempt.username` matches `req.user.username`. Throws `ForbiddenException` if not owned by the user.
*   **`DELETE /:id` (Remove Attempt):**
    *   Protected by: `@UseGuards(JwtAuthGuard)`
    *   Logic:
        *   An `ADMIN` can delete any attempt.
        *   A regular user can only delete an attempt if `attempt.username` matches `req.user.username`. Throws `ForbiddenException` if not owned by the user.

**2. `TestController` (`/tests`)**

*   **`POST /` (Create Test):**
    *   Protected by: `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(UserRole.ADMIN)`
    *   Logic: Only users with the `ADMIN` role can create tests.
*   **`GET /` (Find All Tests, potentially filtered by model):**
    *   Protected by: None (Public)
*   **`GET /:id` (Find One Test):**
    *   Protected by: None (Public)
*   **`DELETE /:id` (Remove Test):**
    *   Protected by: `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(UserRole.ADMIN)`
    *   Logic: Only users with the `ADMIN` role can delete tests.

**3. `TestResultController` (`/test-results`)**

*   **`GET /?attemptId=:attemptId` (Find Test Results for an Attempt):**
    *   Protected by: `@UseGuards(JwtAuthGuard)`
    *   Logic:
        *   Requires a logged-in user.
        *   The service layer then verifies that the logged-in user either owns the specified `Attempt` (i.e., `attempt.username === req.user.username`) or is an `ADMIN`. Throws `ForbiddenException` if access is not permitted.

**4. `UserAccountController` (`/user-accounts`)**

*   **`POST /` (Create User Account):**
    *   Protected by: None (Public)
    *   Logic: Allows self-registration. The service assigns a default role of `[UserRole.USER]` if no roles are specified in the DTO.
*   **`GET /` (Find All User Accounts):**
    *   Protected by: `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(UserRole.ADMIN)`
    *   Logic: Only users with the `ADMIN` role can retrieve all user accounts.
*   **`GET /:username` (Find One User Account):**
    *   Protected by: `@UseGuards(JwtAuthGuard)`
    *   Logic:
        *   An `ADMIN` can retrieve any user account.
        *   A regular user can only retrieve their own account (where `:username` from the path matches `req.user.username`). Throws `ForbiddenException` otherwise.
*   **`PATCH /:username` (Update User Account):**
    *   Protected by: `@UseGuards(JwtAuthGuard)`
    *   Logic:
        *   An `ADMIN` can update any user account (including password and roles).
        *   A regular user can only update their own account.
            *   They cannot change their roles.
            *   Password updates for regular users are disallowed through this generic endpoint (should use a dedicated change password flow, which is not implemented here). Attempting to set a password as a non-admin will result in a `ForbiddenException`.
        *   Throws `ForbiddenException` if a non-admin tries to update another user's account.
*   **`DELETE /:username` (Remove User Account):**
    *   Protected by: `@UseGuards(JwtAuthGuard)`
    *   Logic:
        *   An `ADMIN` can delete any user account.
        *   A regular user can only delete their own account.
        *   Throws `ForbiddenException` if a non-admin tries to delete another user's account.

**5. `ModelsController` (`/models`)**

*   **`GET /available` (Get Available Models):**
    *   Protected by: None (Public)

This list covers all the explicit endpoint protections implemented using `JwtAuthGuard`, `RolesGuard`, and the associated service-layer logic for ownership checks based on `username` and admin roles.
