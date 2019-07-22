FROM registry.cn-hangzhou.aliyuncs.com/weidian-lab/base-screenshot-server:base-0.0.1

WORKDIR /app/

COPY package.json yarn.lock ./

RUN yarn --frozen-lockfile --no-cache --production && \
  rm -rf /tmp/* && rm -rf $HOME/.npm/_cacache && rm -f package.json package-lock.json

COPY app pp

ENV WWW_PATH=/app/www

CMD npm start
