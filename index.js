'use strict';

const fs      = require('fs');
const net     = require('net');
const process = require('process');
const binary  = require('binary');
const _       = require('lodash');

////////////////////////////
// types
const FCGI_BEGIN_REQUEST     =  1
const FCGI_ABORT_REQUEST     =  2
const FCGI_END_REQUEST       =  3
const FCGI_PARAMS            =  4
const FCGI_STDIN             =  5
const FCGI_STDOUT            =  6
const FCGI_STDERR            =  7
const FCGI_DATA              =  8
const FCGI_GET_VALUES        =  9
const FCGI_GET_VALUES_RESULT = 10
const FCGI_UNKNOWN_TYPE      = 11

var type_to_str = [
  null,
  'FCGI_BEGIN_REQUEST',
  'FCGI_ABORT_REQUEST',
  'FCGI_END_REQUEST',
  'FCGI_PARAMS',
  'FCGI_STDIN',
  'FCGI_STDOUT',
  'FCGI_STDERR',
  'FCGI_DATA',
  'FCGI_GET_VALUES',
  'FCGI_GET_VALUES_RESULT',
];

////////////////////////////
function parseContentData(type, contentData) {
  if (type == FCGI_PARAMS) {
    let params = new Map();
    let pos = 0;
    while (pos < contentData.length) {
      const readNumber = () => {
        let n = contentData.readUInt8(pos);
        if ((n & 0x80) > 0) {
          n = contentData.readUInt32BE(pos) & 0x7fffffff
          pos += 4;
        } else {
          pos += 1;
        }
        return n;
      };
      const nameLength = readNumber();
      const valueLength = readNumber();
      let end = pos + nameLength;
      const name = contentData.toString('utf8', pos, end);
      pos = end;
      end = pos + valueLength;
      const value = contentData.toString('utf8', pos, end);
      pos = end;
      params.set(name, value);
    }
    return params;
  } else {
    //XXX more types
    return null; // don't know how to parse content data for this type
  }
}

function parseData(data) {
  let packets = []
  let remaining_bytes = data.length;
  while (true) {
    let vars = binary.parse(data)
                .word8bu('version')
                .word8bu('type')
                .word16bu('requestId')
                .word16bu('contentLength')
                .word8bu('paddingLength')
                .word8bu('reserved')
                .vars;
    vars.typeStr = type_to_str[vars.type];
    let end = 8 + vars.contentLength + vars.paddingLength;
    let contentData = data.slice(8, end);
    vars.contentData = contentData;
    vars.content = parseContentData(vars.type, contentData)
    packets.push(vars);

    remaining_bytes = data.length - end;
    // loop with remaining data
    if (remaining_bytes > 0) {
      data = data.slice(end); // use previous packet end as start of next
    } else break;
  }
  return packets;
}


function dropPrivs(user, group) {
  try {
    console.log('Old User ID: ' + process.getuid() + ', Old Group ID: ' + process.getgid());
    process.setgid(user);
    process.setuid(group);
    console.log('New User ID: ' + process.getuid() + ', New Group ID: ' + process.getgid());
  } catch (err) {
    console.log('Cowardly refusing to keep the process alive as root.');
    process.exit(1);
  }
}
////////////////////////////

const path  = '/var/www/run/slowcgi.sock';
const USER  = 'www';
const GROUP = 'www';
const SOCK_UID = 67;
const SOCK_GID = 67;

let conns = [];

try {
  console.log('TRY UNLINK %s', path);
  fs.unlinkSync(path);
} catch (e) {}
let server = net.createServer().listen(path);
server.on('listening', () => {
  console.log('CHOWN %s', path);
  fs.chownSync(path, SOCK_UID, SOCK_GID);
  dropPrivs(USER, GROUP);
})
server.on('connection', (c) => {
  console.log('NEW CONN');
  c.on('data', (data) => {
    console.log('GOT DATA, length:', data.length);
    let packets = parseData(data);
    console.log('PARSED', packets);
    c.end(); //XXX respond instead of closing
   });
  c.on('close', (had_error) => {
    console.log('CONN CLOSED; had_error:', had_error);
    _.pull(conns, c);
  });
  conns.push(c);
});
server.on('error', (e) => console.log('ERROR: ', e));
