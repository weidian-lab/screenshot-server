## start server

```
docker run -p 3000:3000 \
-e PUPPETEER_POOL_MIN=1 \
-e PUPPETEER_POOL_MAX=1 \
-e PORT=3000
-t sqlwwx/screenshot-server
```

## screenshot

```
curl --request GET \
  --url
'http://127.0.0.1:3000/?url=https%3A%2F%2Fwww.baidu.com&fullPage=1'
>> baidu.jpeg
```

```
curl --request POST \
  --url http://127.0.0.1:3000/ \
  --header 'content-type: application/json' \
  --data
'{"url":"https://www.baidu.com","fullPage":1}'
>> baidu.jpeg
```

## TODO

- [ ] add test
