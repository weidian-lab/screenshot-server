FROM registry.cn-hangzhou.aliyuncs.com/weidian-lab/base-screenshot-server:base-0.0.2

WORKDIR /app/

COPY package.json yarn.lock ./

RUN yarn --frozen-lockfile --no-cache --production && \
  rm -rf /tmp/* && rm -rf $HOME/.npm/_cacache

COPY app app

ENV WWW_PATH=/app/www

CMD npm start
