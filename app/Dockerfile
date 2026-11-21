# GUSTO · imagem da aplicação (API + interface + camada OS) · by m3d.pro
FROM node:26-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:26-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package.json server.js ./
COPY --chown=node:node os ./os
COPY --chown=node:node public ./public
RUN mkdir -p /dados/videos && chown -R node:node /dados
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=4s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
