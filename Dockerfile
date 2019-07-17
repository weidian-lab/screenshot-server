FROM sqlwwx/puppeteer

WORKDIR /app/

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --no-cache --production

COPY lib lib
COPY *.js .

ENV PORT=7001
ENV SCREEN_ALLOW_FILE_SCHEME=true
ENV CHROMIUM_ARGS=--no-sandbox,--disable-gpu,--single-process,--disable-dev-shm-usage

CMD npm start
