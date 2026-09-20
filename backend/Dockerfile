# The Playwright image includes Chromium and its required Linux libraries.
# Keep this version aligned with backend/package-lock.json (playwright 1.63.0).
FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV NODE_ENV=production
CMD ["npm", "start"]
