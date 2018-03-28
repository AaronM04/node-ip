node-ip
============

A quick and (very) dirty Node.js
[FastCGI](http://www.mit.edu/~yandros/doc/specs/fcgi-spec.html) interface to
[OpenBSD httpd(8)](https://man.openbsd.org/httpd.8). Binds Unix socket to
/var/www/run/slowcgi.sock, then drops privileges to user www and group www, and
responds to requests. Not production-ready. *No, really, do not even think
about using this in production!*

```
sudo node .
```
