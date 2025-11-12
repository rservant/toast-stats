export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  expiresIn: number
}

export interface RefreshRequest {
  token: string
}

export interface RefreshResponse {
  token: string
  expiresIn: number
}

export interface LogoutRequest {
  token: string
}

export interface LogoutResponse {
  success: boolean
}

export interface TokenPayload {
  userId: string
  username: string
  iat: number
  exp: number
}

export interface AuthError {
  code: string
  message: string
}
