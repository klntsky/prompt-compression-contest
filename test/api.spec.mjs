import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import dotenv from 'dotenv';
import { URLSearchParams } from 'url';
import { expect } from 'chai';

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

// Simplified logger for test output, Mocha will handle overall reporting
const log = (message, data) => {
  console.log(message);
  if (data) {
    if (typeof data === 'string' && data.trim().startsWith('<!DOCTYPE html>')) {
      console.log('(HTML response suppressed)');
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  }
  console.log('---');
};

describe('API Tests', () => {
  let apiClient;
  let userClient;
  let adminClient;

  before(() => {
    if (!ADMIN_LOGIN || !ADMIN_PASSWORD) {
      console.error(
        'FATAL: ADMIN_DEFAULT_LOGIN and/or ADMIN_DEFAULT_PASSWORD not set in environment variables.'
      );
      // Mocha will typically exit if a fatal error occurs in `before`
      // Forcing exit might be too abrupt for some CI environments,
      // but essential if tests cannot run.
      process.exit(1);
    }
    apiClient = createApiClient(); // For general, unauthenticated, or initial requests
    userClient = createApiClient(); // For regular user session
    adminClient = createApiClient(); // For admin session
  });

  describe('Auth Tests', () => {
    it('should register a new user successfully and redirect to login', async () => {
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

      expect(response.status).to.equal(302);
      expect(response.headers.location).to.include('/auth/login');
      log('Registration successful, redirected to:', response.headers.location);
    });

    it('should fail with 400 when trying to register an existing user', async () => {
      const params = new URLSearchParams();
      params.append('username', testUser.username);
      params.append('email', testUser.email);
      params.append('password', testUser.password);
      try {
        await apiClient.post('/auth/register', params, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          maxRedirects: 0,
        });
        // If we reach here, the request didn't fail as expected.
        throw new Error(
          'Registration of existing user did not fail with a non-2xx status.'
        );
      } catch (error) {
        expect(
          error.response,
          'Error response should exist for a failed registration'
        ).to.exist;
        expect(error.response.status).to.equal(400);
        log(
          'Registration of existing user correctly failed with 400',
          error.response.data
        );
      }
    });

    it('should login as new user successfully and allow profile access', async () => {
      const params = new URLSearchParams();
      params.append('username', testUser.username);
      params.append('password', testUser.password);
      const response = await userClient.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        maxRedirects: 0,
        validateStatus: status => status === 302,
      });
      expect(response.headers.location).to.include('/auth/profile');
      log('User login successful, redirected to:', response.headers.location);

      const profileRes = await userClient.get('/auth/profile');
      expect(profileRes.data.user).to.deep.include({
        id: testUser.username,
      });
      log('Profile access verified for user:', profileRes.data.user);
    });

    it('should login as admin successfully and allow profile access with admin rights', async () => {
      const params = new URLSearchParams();
      params.append('username', ADMIN_LOGIN);
      params.append('password', ADMIN_PASSWORD);
      const response = await adminClient.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        maxRedirects: 0,
        validateStatus: status => status === 302,
      });
      expect(response.headers.location).to.include('/auth/profile');
      log('Admin login successful, redirected to:', response.headers.location);

      const profileRes = await adminClient.get('/auth/profile');
      expect(profileRes.data.user).to.deep.include({
        id: ADMIN_LOGIN,
        isAdmin: true,
      });
      log('Profile access verified for admin:', profileRes.data.user);
    });
  });

  describe('Attempt Tests (as regular user)', () => {
    it('should submit an attempt successfully', async () => {
      // Ensure user is logged in (idempotent login or rely on previous test state)
      // For true isolation, each test block could log in the userClient.
      // Here we assume userClient is already authenticated from 'Auth Tests'.
      const attemptPayload = {
        compressing_prompt: 'Test compressing prompt from script',
        model: 'test-model-from-script',
      };
      const response = await userClient.post(
        '/api/attempts/create',
        attemptPayload
      );
      expect(response.status).to.equal(201);
      expect(response.data).to.have.property('attemptId');
      log('Attempt submitted successfully:', response.data);
    });

    it('should respect attempt submission rate limit (10 per hour)', async function () {
      this.timeout(20000); // Increase timeout for this specific test

      const rateLimitTestUser = {
        username: `ratelimittest_${generateRandomString()}`,
        email: `ratelimittest_${generateRandomString()}@example.com`,
        password: 'RateLimitTestPassword123!',
      };
      const rateLimitApiClient = createApiClient();
      const rateLimitUserClient = createApiClient();

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
      const loginResponse = await rateLimitUserClient.post(
        '/auth/login',
        loginParams,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          maxRedirects: 0,
          validateStatus: status => status === 302,
        }
      );
      expect(loginResponse.headers.location).to.include('/auth/profile');
      log('Rate limit test user logged in');

      const profileRes = await rateLimitUserClient.get('/auth/profile');
      expect(profileRes.data.user).to.deep.include({
        id: rateLimitTestUser.username,
      });
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
        expect(response.status, `Attempt ${i + 1} status`).to.equal(201);
        expect(response.data, `Attempt ${i + 1} data`).to.have.property(
          'attemptId'
        );
        log(
          `Attempt ${i + 1} submitted successfully:`,
          response.data.attemptId
        );
      }

      // The 11th request should be rate-limited
      try {
        await rateLimitUserClient.post('/api/attempts/create', attemptPayload);
        throw new Error(
          '11th attempt submission was not rate-limited as expected.'
        );
      } catch (error) {
        expect(error.response, 'Error response for 11th attempt').to.exist;
        expect(error.response.status).to.equal(429);
        log(
          '11th attempt submission correctly rate-limited (429)',
          error.response.data
        );
      }
    });
  });

  describe('Test (Admin) Tests', () => {
    it('should allow admin to submit a test successfully', async () => {
      // Ensure adminClient is authenticated (relies on 'Auth Tests' or add login here)
      const uniqueModelName = `admin-test-model-${generateRandomString(4)}`;
      const testPayload = {
        model: uniqueModelName,
        payload: {
          data: 'some test payload from script',
          random: generateRandomString(4),
        },
      };
      const response = await adminClient.post('/api/tests/submit', testPayload);
      expect(response.status).to.equal(201);
      expect(response.data).to.have.property('testId');
      log('Test submitted successfully by admin:', response.data);
    });

    it('should prevent regular user from submitting a test (403 Forbidden)', async () => {
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
        expect(error.response, 'Error response for user test submission').to
          .exist;
        expect(error.response.status).to.equal(403);
        log(
          'Test submission by regular user correctly failed with 403',
          error.response.data
        );
      }
    });
  });

  describe('Logout Tests', () => {
    it('should logout user successfully and prevent profile access', async () => {
      const response = await userClient.get('/auth/logout', {
        maxRedirects: 0,
        validateStatus: status => status === 302,
      });
      expect(response.headers.location).to.include('/auth/login');
      log('User logout successful, redirected to:', response.headers.location);

      try {
        await userClient.get('/auth/profile');
        throw new Error('Profile still accessible after logout');
      } catch (error) {
        expect(error.response, 'Error response for profile access after logout')
          .to.exist;
        // User should be redirected to login (302) or get Unauthorized (401)
        expect([302, 401]).to.include(error.response.status);
        if (error.response.status === 302) {
          expect(error.response.headers.location).to.include('/auth/login');
        }
        log('Profile access correctly failed/redirected after logout.', {
          status: error.response.status,
          data: error.response.data,
        });
      }
    });

    it('should logout admin successfully', async () => {
      const response = await adminClient.get('/auth/logout', {
        maxRedirects: 0,
        validateStatus: status => status === 302,
      });
      expect(response.headers.location).to.include('/auth/login');
      log('Admin logout successful, redirected to:', response.headers.location);

      // Optionally, verify admin profile is no longer accessible
      try {
        await adminClient.get('/auth/profile');
        throw new Error('Admin profile still accessible after logout');
      } catch (error) {
        expect(
          error.response,
          'Error response for admin profile access after logout'
        ).to.exist;
        expect([302, 401]).to.include(error.response.status);
        if (error.response.status === 302) {
          expect(error.response.headers.location).to.include('/auth/login');
        }
        log('Admin profile access correctly failed/redirected after logout.');
      }
    });
  });

  describe('Registration Rate Limit Tests (Basic)', () => {
    // This test relies on the IP address and the server's in-memory counter.
    // It might be flaky depending on how many times tests are run without server restart.
    // Ideally, the server would provide a way to reset rate limits for testing.

    it('should allow a couple of registrations then rate limit subsequent ones', async function () {
      this.timeout(15000); // Allow more time

      const tempApiClient = createApiClient(); // Use a fresh client

      // Attempt 1
      let firstRegUsername = `reglimit1_${generateRandomString()}`;
      let firstRegEmail = `${firstRegUsername}@example.com`;
      const params1 = new URLSearchParams();
      params1.append('username', firstRegUsername);
      params1.append('email', firstRegEmail);
      params1.append('password', testUser.password);

      try {
        const reg1Response = await tempApiClient.post(
          '/auth/register',
          params1,
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            maxRedirects: 0,
            validateStatus: s => s === 302 || s === 200 || s === 201,
          }
        );
        expect(reg1Response.status).to.be.oneOf([200, 201, 302]);
        log(
          'First registration attempt in rate limit test successful:',
          reg1Response.status
        );
      } catch (error) {
        if (error.response && error.response.status === 429) {
          console.warn(
            'First registration attempt in rate limit test was rate-limited (429). Proceeding to check subsequent attempts.'
          );
        } else {
          console.error(
            'First registration attempt in rate limit test failed with unexpected error:',
            error.message
          );
          throw error; // Re-throw unexpected errors
        }
      }

      // Attempt 2
      let secondRegUsername = `reglimit2_${generateRandomString()}`;
      let secondRegEmail = `${secondRegUsername}@example.com`;
      const params2 = new URLSearchParams();
      params2.append('username', secondRegUsername);
      params2.append('email', secondRegEmail);
      params2.append('password', testUser.password);

      try {
        const reg2Response = await tempApiClient.post(
          '/auth/register',
          params2,
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            maxRedirects: 0,
            validateStatus: s => s === 302 || s === 200 || s === 201,
          }
        );
        // Assuming a limit of 2 per IP per day (as hinted in original comments)
        // This second one should pass if the first one passed and limit wasn't already hit.
        expect(reg2Response.status).to.be.oneOf([200, 201, 302]);
        log(
          'Second registration attempt in rate limit test successful:',
          reg2Response.status
        );
      } catch (error) {
        if (error.response && error.response.status === 429) {
          console.warn(
            'Second registration attempt in rate limit test was rate-limited (429). Proceeding to check subsequent attempts.'
          );
        } else {
          console.error(
            'Second registration attempt in rate limit test failed with unexpected error:',
            error.message
          );
          throw error; // Re-throw unexpected errors
        }
      }

      // Attempt 3 - This one should be rate-limited
      let thirdRegUsername = `reglimit3_${generateRandomString()}`;
      let thirdRegEmail = `${thirdRegUsername}@example.com`;
      const params3 = new URLSearchParams();
      params3.append('username', thirdRegUsername);
      params3.append('email', thirdRegEmail);
      params3.append('password', testUser.password);
      try {
        await tempApiClient.post('/auth/register', params3, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          maxRedirects: 0,
        });
        throw new Error(
          'Third registration attempt should have been rate limited but was not.'
        );
      } catch (error) {
        expect(error.response, 'Error response for third registration').to
          .exist;
        expect(error.response.status).to.equal(429);
        log(
          'Third registration attempt correctly rate limited (429)',
          error.response.data
        );
      }
    });
  });
});
