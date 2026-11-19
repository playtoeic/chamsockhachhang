// Biến môi trường dùng chung giữa máy chủ e2e và các test e2e. Không dùng giá trị thật.
export const E2E_ENV = {
  DATABASE_URL:
    process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:54331/inbox_e2e",
  OWNER_EMAIL: "owner@test.local",
  CREDENTIALS_KEY: Buffer.alloc(32, 7).toString("base64"),
  AUTH_SECRET: "e2e-auth-secret",
  AUTH_TRUST_HOST: "true",
  GOOGLE_CLIENT_ID: "e2e-google-client",
  GOOGLE_CLIENT_SECRET: "e2e-google-secret",
  ENABLE_SIMULATOR: "true",
  SIMULATOR_SECRET: "e2e-simulator-secret",
  META_HUMAN_AGENT: "false",
};
