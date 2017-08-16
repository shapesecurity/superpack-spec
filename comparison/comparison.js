let fs = require('fs');

let ARSON = require('arson');
let bencode = require('bencode-js');
let BSON = require('bson');
let edn = require('edn')
let msgpack = require('msgpack');
let superpack = require('superpack');
var cbor = require('cbor-sync');
var yaml = require('js-yaml');

let zlib = require('zlib');

function* lines(buffer) {
  while (true) {
    let index = buffer.indexOf('\n');
    if (index < 0) {
      yield buffer;
      break;
    } else {
      yield buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
    }
  }
}

const file = 'node_modules/public-domain-nypl-captures/data/pd_items.ndjson';
let data = Array.from(lines(fs.readFileSync(file))).slice(0, 1000).map(JSON.parse);

let results = {
  ARSON: ARSON.encode(data),
  JSON: JSON.stringify(data, null, 0),
  BSON: new BSON().serialize(data),
  'SuperPack (built-in optimisations)': superpack.encode(data, { extensions: superpack.default.recommendedOptimisations }),
  'SuperPack (no optimisations)': superpack.encode(data),
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
