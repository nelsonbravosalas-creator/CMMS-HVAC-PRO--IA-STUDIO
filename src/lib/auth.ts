// Google OAuth / Firebase auth is not used in this project.
// Auth is handled via JWT tokens issued by the Express backend (/api/auth).
// These stubs maintain the same export surface to avoid breaking imports.

export const initAuth = (
  _onAuthSuccess?: (user: any, token: string) => void,
  _onAuthFailure?: () => void
) => {
  return () => {};
};

export const googleSignIn = async (): Promise<null> => {
  return null;
};

export const getAccessToken = async (): Promise<string | null> => {
  return null;
};

export const logout = async () => {};
