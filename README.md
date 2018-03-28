node-ip
============

A quick and (very) dirty FastCGI interface to OpenHTTPD. Binds Unix socket to
/var/www/run/slowcgi.sock, then drops privileges to user www and group www, and
responds to requests. Not production-ready. *No, really, do not even think
about using this in production!*

```
sudo node .
```
