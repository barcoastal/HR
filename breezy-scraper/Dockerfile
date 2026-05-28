# Playwright's official image already includes Chromium + every system lib
# it needs. We just layer our small Node worker on top.
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY scraper.mjs ./

# Run as the non-root user the Playwright image provides.
USER pwuser

CMD ["node", "scraper.mjs"]
