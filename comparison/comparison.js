let fs = require('fs');

let bencode = require('bencode-js');
let bson = require('bson');
let edn = require('edn')
let msgpack = require('msgpack');
let superpack = require('superpack');
var cbor = require('cbor-sync');
var yaml = require('js-yaml');

let zlib = require('zlib');

let data = JSON.parse(fs.readFileSync('data.json').toString('utf8'));

let results = {
  JSON: JSON.stringify(data, null, 0),
  BSON: new bson.BSONPure.BSON().serialize(data),
  SuperPack: superpack.encode(data),
  MessagePack: msgpack.pack(data),
  bencode: bencode.encode(data),
  edn: edn.stringify(data),
  CBOR: cbor.encode(data),
  YAML: yaml.safeDump(data),
};

var algos = Object.keys(results).sort((a, b) => results[a].length - results[b].length);

algos.forEach((algo) => {
  var result = results[algo];
  if (typeof result === 'string') result = Buffer.from(result, 'utf8');
  else if (Array.isArray(result)) result = Buffer.from(result);
  console.log('%s: %dB; after gzip: %dB', algo, result.length, zlib.gzipSync(result).length);
});
