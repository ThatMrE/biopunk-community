# Biopunk News — one Node process, one SQLite file, zero npm dependencies.
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8080 \
    BIOPUNK_DB=/data/biopunk-news.db

WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY src ./src
COPY public ./public

RUN mkdir -p /data && chown -R node:node /data /app
VOLUME ["/data"]
USER node

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
