/**
 * Augments the Express.User type globally.
 * This ensures that req.user is correctly typed throughout the application
 * after authentication. It should align with what passport.deserializeUser provides.
 */
declare global {
  namespace Express {
    interface User {
      id: string; // Typically the user's unique identifier (e.g., login or UUID)
      isAdmin?: boolean;
    }

    // Define LogOutOptions if not available from @types/passport or @types/express
    // This might be needed if req.logout() is called with options.
    interface LogOutOptions {
      keepSessionInfo?: boolean;
    }
  }
}

// Export something to make it a module, ensuring it's processed by TypeScript.
// An empty export is sufficient if there are no other specific exports from this file.
export {};
