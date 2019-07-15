FROM sqlwwx/puppeteer

WORKDIR /root/

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --no-cache --production

COPY lib lib
COPY *.js .

ENV PORT=3000
ENV CHROMIUM_ARGS=--no-sandbox,--disable-gpu,--single-process,--disable-dev-shm-usage

CMD npm start
