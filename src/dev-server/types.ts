export type DesignerSettings = {
  apiBaseUrl: string;
  useDevProxy: boolean;
};

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  role: string;
};

export type AuthSession = {
  authenticated: boolean;
  user?: AuthUser;
};

export type StoredSession = {
  user: AuthUser;
  expiresAt: number;
};

export type LoginRequest = {
  username?: string;
  password?: string;
};

export type AccountRow = {
  account_id: number;
  username: string;
  email: string;
  password: string;
  role_name: string;
};

export type MysqlConnectionConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};
