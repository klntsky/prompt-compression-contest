import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import dotenv from 'dotenv';
import { URLSearchParams } from 'url';

dotenv.config(); // Load environment variables from .env file

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Helper to create a new axios instance with its own cookie jar for session management
const createApiClient = () => {
  const jar = new CookieJar();
  return wrapper(axios.create({ baseURL: BASE_URL, jar }));
};

const ADMIN_LOGIN = process.env.ADMIN_DEFAULT_LOGIN;
const ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD;

const generateRandomString = (length = 8) =>
  Math.random()
    .toString(36)
    .substring(2, 2 + length);

const testUser = {
  username: `testuser_${generateRandomString()}`,
  email: `testuser_${generateRandomString()}@example.com`,
  password: 'TestPassword123!', // Make sure this meets your password strength requirements
};

let testRunSuccess = true;

const log = (message, data) => {
  console.log(message);
  if (data) {
    // Avoid logging full HTML responses for brevity
    if (typeof data === 'string' && data.trim().startsWith('<!DOCTYPE html>')) {
      console.log('(HTML response suppressed)');
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  }
  console.log('---');
};

const runTest = async (description, testFn) => {
  console.log(`Running test: ${description}`);
  try {
    await testFn();
    log(`✅ PASSED: ${description}`);
  } catch (error) {
    testRunSuccess = false;
    log(`❌ FAILED: ${description}`);
    if (error.response) {
      log('Error Status:', error.response.status);
      log('Error Data:', error.response.data);
    } else {
      log('Error Message:', error.message);
    }
  }
};

async function main() {
  if (!ADMIN_LOGIN || !ADMIN_PASSWORD) {
    console.error(
      'FATAL: ADMIN_DEFAULT_LOGIN and/or ADMIN_DEFAULT_PASSWORD not set in environment variables.'
    );
    process.exit(1);
  }

  const apiClient = createApiClient(); // For general, unauthenticated, or initial requests
  const userClient = createApiClient(); // For regular user session
  const adminClient = createApiClient(); // For admin session

  // --- Auth Tests ---
  await runTest('Register new user - success', async () => {
    const params = new URLSearchParams();
    params.append('username', testUser.username);
    params.append('email', testUser.email);
    params.append('password', testUser.password);

    const response = await apiClient.post('/auth/register', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 0,
      validateStatus: status =>
        status === 302 || status === 200 || status === 201,
    });
    if (
      response.status !== 302 ||
      !response.headers.location?.includes('/auth/login')
    ) {
      throw new Error(
        `Expected redirect to /auth/login, got status ${response.status} and location ${response.headers.location}`
      );
    }
    log('Registration successful, redirected to:', response.headers.location);
  });

  await runTest('Register existing user - should fail or inform', async () => {
    const params = new URLSearchParams();
    params.append('username', testUser.username);
    params.append('email', testUser.email);
    params.append('password', testUser.password);
    try {
      await apiClient.post('/auth/register', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        maxRedirects: 0,
      });
      throw new Error(
        'Registration of existing user did not fail as expected.'
      );
    } catch (error) {
      if (error.response && error.response.status === 400) {
        log(
          'Registration of existing user correctly failed with 400',
          error.response.data
        );
      } else {
        throw error;
      }
    }
  });

  await runTest('Login as new user - success', async () => {
    const params = new URLSearchParams();
    params.append('username', testUser.username);
    params.append('password', testUser.password);
    const response = await userClient.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 0,
      validateStatus: status => status === 302,
    });
    if (!response.headers.location?.includes('/auth/profile')) {
      throw new Error(
        `Expected redirect to /auth/profile, got ${response.headers.location}`
      );
    }
    log('User login successful, redirected to:', response.headers.location);
    const profileRes = await userClient.get('/auth/profile');
    if (!profileRes.data || profileRes.data.user?.id !== testUser.username) {
      throw new Error('Failed to access profile or user ID mismatch');
    }
    log('Profile access verified for user:', profileRes.data.user);
  });

  await runTest('Login as admin - success', async () => {
    const params = new URLSearchParams();
    params.append('username', ADMIN_LOGIN);
    params.append('password', ADMIN_PASSWORD);
    const response = await adminClient.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 0,
      validateStatus: status => status === 302,
    });
    if (!response.headers.location?.includes('/auth/profile')) {
      throw new Error(
        `Expected redirect to /auth/profile, got ${response.headers.location}`
      );
    }
    log('Admin login successful, redirected to:', response.headers.location);
    const profileRes = await adminClient.get('/auth/profile');
    if (
      !profileRes.data ||
      profileRes.data.user?.id !== ADMIN_LOGIN ||
      !profileRes.data.user?.isAdmin
    ) {
      throw new Error('Failed to access profile or admin user data mismatch');
    }
    log('Profile access verified for admin:', profileRes.data.user);
  });

  // --- Attempt Tests (as regular user) ---
  await runTest('Submit attempt - success', async () => {
    const attemptPayload = {
      compressing_prompt: 'Test compressing prompt from script',
      model: 'test-model-from-script',
    };
    const response = await userClient.post(
      '/api/attempts/create',
      attemptPayload
    );
    if (response.status !== 201 || !response.data.attemptId) {
      throw new Error(
        `Attempt submission failed or did not return attemptId. Status: ${response.status}`
      );
    }
    log('Attempt submitted successfully:', response.data);
  });

  await runTest('Attempt submission rate limit (10 per hour)', async () => {
    const rateLimitTestUser = {
      username: `ratelimittest_${generateRandomString()}`,
      email: `ratelimittest_${generateRandomString()}@example.com`,
      password: 'RateLimitTestPassword123!',
    };
    const rateLimitApiClient = createApiClient(); // For registration
    const rateLimitUserClient = createApiClient(); // For logged-in user actions

    // Register user
    const regParams = new URLSearchParams();
    regParams.append('username', rateLimitTestUser.username);
    regParams.append('email', rateLimitTestUser.email);
    regParams.append('password', rateLimitTestUser.password);
    await rateLimitApiClient.post('/auth/register', regParams, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 0,
      validateStatus: status =>
        status === 302 || status === 200 || status === 201,
    });
    log('Rate limit test user registered');

    // Login user
    const loginParams = new URLSearchParams();
    loginParams.append('username', rateLimitTestUser.username);
    loginParams.append('password', rateLimitTestUser.password);
    await rateLimitUserClient.post('/auth/login', loginParams, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 0,
      validateStatus: status => status === 302,
    });
    log('Rate limit test user logged in');
    // Verify login by accessing profile
    const profileRes = await rateLimitUserClient.get('/auth/profile');
    if (
      !profileRes.data ||
      profileRes.data.user?.id !== rateLimitTestUser.username
    ) {
      throw new Error(
        'Failed to access profile for rate limit test user or user ID mismatch'
      );
    }
    log('Profile access verified for rate limit test user');

    const attemptPayload = {
      compressing_prompt: 'Rate limit test prompt',
      model: 'rl-test-model',
    };

    // Make 10 successful requests
    for (let i = 0; i < 10; i++) {
      const response = await rateLimitUserClient.post(
        '/api/attempts/create',
        attemptPayload
      );
      if (response.status !== 201 || !response.data.attemptId) {
        throw new Error(
          `Attempt submission ${i + 1} failed or did not return attemptId. Status: ${
            response.status
          }`
        );
      }
      log(`Attempt ${i + 1} submitted successfully:`, response.data.attemptId);
    }

    // The 11th request should be rate-limited
    try {
      await rateLimitUserClient.post('/api/attempts/create', attemptPayload);
      throw new Error(
        '11th attempt submission was not rate-limited as expected.'
      );
    } catch (error) {
      if (error.response && error.response.status === 429) {
        log(
          '11th attempt submission correctly rate-limited (429)',
          error.response.data
        );
      } else {
        log('11th attempt submission failed with unexpected error or status:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        throw error;
      }
    }
  });

  // --- Test (Admin) Tests ---
  await runTest('Submit test by admin - success', async () => {
    const uniqueModelName = `admin-test-model-${generateRandomString(4)}`;
    const testPayload = {
      model: uniqueModelName,
      payload: {
        data: 'some test payload from script',
        random: generateRandomString(4),
      },
    };
    const response = await adminClient.post('/api/tests/submit', testPayload);
    if (response.status !== 201 || !response.data.testId) {
      throw new Error(
        `Test submission failed or did not return testId. Status: ${response.status}`
      );
    }
    log('Test submitted successfully by admin:', response.data);
  });

  await runTest(
    'Submit test by regular user - should fail (403 Forbidden)',
    async () => {
      const testPayload = {
        model: 'user-attempt-test-model',
        payload: { data: 'user trying to submit to admin endpoint' },
      };
      try {
        await userClient.post('/api/tests/submit', testPayload);
        throw new Error(
          'Test submission by regular user did not fail as expected.'
        );
      } catch (error) {
        if (error.response && error.response.status === 403) {
          log(
            'Test submission by regular user correctly failed with 403',
            error.response.data
          );
        } else {
          throw error;
        }
      }
    }
  );

  // --- Logout Tests ---
  await runTest('Logout user - success', async () => {
    const response = await userClient.get('/auth/logout', {
      maxRedirects: 0,
      validateStatus: status => status === 302,
    });
    if (!response.headers.location?.includes('/auth/login')) {
      throw new Error(
        `Expected redirect to /auth/login after logout, got ${response.headers.location}`
      );
    }
    log('User logout successful, redirected to:', response.headers.location);
    try {
      await userClient.get('/auth/profile');
      throw new Error('Profile still accessible after logout');
    } catch (error) {
      if (
        error.response &&
        (error.response.status === 401 || error.response.status === 302)
      ) {
        log('Profile access correctly failed/redirected after logout.', {
          status: error.response.status,
          data: error.response.data,
        });
      } else {
        throw error;
      }
    }
  });

  await runTest('Logout admin - success', async () => {
    const response = await adminClient.get('/auth/logout', {
      maxRedirects: 0,
      validateStatus: status => status === 302,
    });
    if (!response.headers.location?.includes('/auth/login')) {
      throw new Error(
        `Expected redirect to /auth/login after logout, got ${response.headers.location}`
      );
    }
    log('Admin logout successful, redirected to:', response.headers.location);
  });

  // --- Rate Limit Tests (Basic) ---
  // Note: Precise rate limit testing is complex and might require manipulating time
  // or making many requests. These are very basic checks.

  await runTest(
    'Registration rate limit - attempt quick re-registrations',
    async () => {
      // Assumes the first registration in these tests counted towards the limit for this IP.
      // The global successfulRegistrations map is in-memory and shared across test runs if server isn\'t restarted.
      // This test is very basic and its success depends on the current state of successfulRegistrations map.
      let secondRegUsername = `testreglimit_${generateRandomString()}`;
      let secondRegEmail = `${secondRegUsername}@example.com`;
      const params1 = new URLSearchParams();
      params1.append('username', secondRegUsername);
      params1.append('email', secondRegEmail);
      params1.append('password', testUser.password);
      const reg2 = await apiClient.post('/auth/register', params1, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        maxRedirects: 0,
        validateStatus: s => s === 302 || s === 200,
      });
      log('Second registration attempt status:', reg2.status);
      if (reg2.status !== 302)
        throw new Error(
          'Second registration should succeed if limit is 2 per IP per day and this is the second one.'
        );

      let thirdRegUsername = `testreglimit2_${generateRandomString()}`;
      let thirdRegEmail = `${thirdRegUsername}@example.com`;
      const params2 = new URLSearchParams();
      params2.append('username', thirdRegUsername);
      params2.append('email', thirdRegEmail);
      params2.append('password', testUser.password);
      try {
        await apiClient.post('/auth/register', params2, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          maxRedirects: 0,
        });
        throw new Error(
          'Third registration attempt should have been rate limited but was not.'
        );
      } catch (error) {
        if (error.response && error.response.status === 429) {
          log(
            'Third registration attempt correctly rate limited (429)',
            error.response.data
          );
        } else {
          log('Third registration error (unexpected):', error.message);
          throw error;
        }
      }
    }
  );

  console.log('\n--- Test Run Summary ---');
  if (testRunSuccess) {
    console.log('✅ All tests passed!');
  } else {
    console.log('❌ Some tests failed.');
    process.exit(1); // Exit with error code if any test failed
  }
}

main().catch(err => {
  console.error('Unhandled error during test execution:', err);
  process.exit(1);
});
