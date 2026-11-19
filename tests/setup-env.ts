// Biến môi trường cố định cho mọi test. Không dùng giá trị thật.
import os from "node:os";
import path from "node:path";

process.env.OWNER_EMAIL ??= "owner@test.local";
process.env.CREDENTIALS_KEY ??= Buffer.alloc(32, 7).toString("base64");
process.env.AUTH_SECRET ??= "test-auth-secret";
process.env.ENABLE_SIMULATOR ??= "true";
process.env.SIMULATOR_SECRET ??= "test-simulator-secret";
process.env.UPLOAD_DIR ??= path.join(os.tmpdir(), `inbox-test-uploads-${process.pid}`);
process.env.APP_URL ??= "http://localhost:3000";
process.env.META_HUMAN_AGENT ??= "false";
