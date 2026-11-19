# Ứng dụng chạy thành một tiến trình Node thường trực (research.md R2, R5, R9).

# ---- build ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ---- run ----
FROM node:22-bookworm-slim AS run
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    ENABLE_SIMULATOR=false \
    UPLOAD_DIR=/data/uploads \
    PORT=3000
COPY package.json package-lock.json ./
# Chỉ thư viện chạy thật, cộng Prisma CLI để chạy migration khi khởi động.
RUN npm ci --omit=dev && npm install --no-save prisma@6.19.3 && npm cache clean --force
COPY --from=build /app/.next ./.next
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/next.config.ts ./next.config.ts
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p ${PORT}"]
