import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    username?: string;
    password?: string;
  }>({});

  const { login } = useAuth();
  const navigate = useNavigate();

  const validateForm = (): boolean => {
    const errors: { username?: string; password?: string } = {};

    if (!username.trim()) {
      errors.username = 'Username is required';
    }

    if (!password.trim()) {
      errors.password = 'Password is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setValidationErrors({});

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await login(username, password);
      // Redirect to dashboard on successful login
      navigate('/dashboard');
    } catch (err: unknown) {
      // Display error message for authentication failures
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status === 401) {
        setError('Invalid username or password');
      } else if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else if (error instanceof Error && error.message) {
        setError(error.message);
      } else {
        setError('An error occurred during login. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <main className="bg-white p-8 rounded-lg shadow-md w-full max-w-md" id="main-content">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Toastmasters District Visualizer
        </h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-6 text-center">
          Login
        </h2>

        <form onSubmit={handleSubmit} noValidate aria-label="Login form">
          {/* General error message */}
          {error && (
            <div
              className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Username field */}
          <div className="mb-4">
            <label
              htmlFor="username"
              className="block text-gray-700 font-medium mb-2"
            >
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white ${
                validationErrors.username
                  ? 'border-red-500'
                  : 'border-gray-300'
              }`}
              disabled={isLoading}
              aria-invalid={!!validationErrors.username}
              aria-describedby={
                validationErrors.username ? 'username-error' : undefined
              }
            />
            {validationErrors.username && (
              <p
                id="username-error"
                className="mt-1 text-sm text-red-600"
                role="alert"
              >
                {validationErrors.username}
              </p>
            )}
          </div>

          {/* Password field */}
          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-gray-700 font-medium mb-2"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white ${
                validationErrors.password
                  ? 'border-red-500'
                  : 'border-gray-300'
              }`}
              disabled={isLoading}
              aria-invalid={!!validationErrors.password}
              aria-describedby={
                validationErrors.password ? 'password-error' : undefined
              }
            />
            {validationErrors.password && (
              <p
                id="password-error"
                className="mt-1 text-sm text-red-600"
                role="alert"
              >
                {validationErrors.password}
              </p>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2 px-4 rounded-lg font-medium text-white transition-colors ${
              isLoading
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Logging in...
              </span>
            ) : (
              'Login'
            )}
          </button>
        </form>
      </main>
    </div>
  );
};

export default LoginPage;
