# SuperPack

SuperPack is a data serialisation format. Due to its design and the
optimisations enabled by its [extension mechanism](#extensions), it is
particularly suitable for encoding values with repeated structure: arrays of
booleans, strings used more than once, objects which have the same shape, etc.

A comparison of schemaless serialisation formats run on 1000 [public domain book records](https://www.npmjs.com/package/public-domain-nypl-captures)
from the [New York Public Library Digital Collections API](http://api.repo.nypl.org/):

| name                                                                 | encoded size | gzip compressed | extensible    | rich built-in types | human-readable |
| -------------------------------------------------------------------- | -----------: | --------------: | ----------    | ------------------- | -------------- |
| *SuperPack*<sup>1</sup>                                              |      768.1KB |         225.8KB | YES           | no                  | no             |
| [Sereal](https://github.com/Sereal/Sereal)                           |     1442.2KB |         268.3KB | YES           | no                  | no             |
| [MessagePack](http://msgpack.org)                                    |     2019.7KB |         271.7KB | YES           | no                  | no             |
| *SuperPack*<sup>2</sup>                                              |     2024.5KB |         264.5KB | YES           | no                  | no             |
| [CBOR](http://cbor.io/)                                              |     2025.6KB |         270.4KB | YES           | YES                 | no             |
| [ARSON](https://github.com/benjamn/arson)                            |     2048.1KB |         361.5KB | theoretically | YES                 | arguably       |
| [bencode](https://wiki.theory.org/BitTorrentSpecification#Bencoding) |     2208.2KB |         273.8KB | no            | no                  | arguably       |
| [edn](https://github.com/edn-format/edn)                             |     2257.8KB |         261.2KB | YES           | no                  | YES            |
| [JSON](http://www.json.org/)                                         |     2276.0KB |         260.9KB | no            | no                  | arguably       |
| [BSON](http://bsonspec.org/)                                         |     2353.0KB |         314.4KB | YES           | YES                 | no             |
| [YAML](http://yaml.org/)                                             |     2444.7KB |         275.7KB | YES           | no                  | YES            |


SuperPack is designed to

* achieve a small encoded payload size
* have a reasonably small transcoder
* encode data of an (a priori) unknown schema
* transcode arbitrary data types without consulting the SuperPack authors by
  using the [extension](#extensions) capabilities
* operate in an environment without access to a lossless data compression algorithm


## Overview

### Terminology and Requirements

The SuperPack format specifies 256 *type tags* for representing values of
various data types.

A *SuperPack value* is an encoded representation of a value. It starts with a
type tag and can be decoded without backtracking. The number of bytes that
comprise the SuperPack value may not be known until it is fully decoded.

A *SuperPack payload* is a byte sequence containing one SuperPack value,
prepended by up to one SuperPack value for each enabled extension.

A SuperPack encoder is a function from a value to a SuperPack payload. A
SuperPack decoder is a function from a SuperPack payload to a value.

- When a value has more than one equivalent representation (e.g. the integer 0
  as uint6, uint14, nint4, etc.), a SuperPack encoder may produce any
  applicable representation.
- When a value has more than one equivalent representaion, a SuperPack encoder
  should produce a SuperPack value with the shortest length possible.
- A SuperPack encoder is not required to produce all possible SuperPack values
  (it may always use str\* for strings, etc).
- A SuperPack decoder must be able to decode any SuperPack value.

### Type Tags

| Hex  | Dec | Binary   | Tag Name                  |
| ---- | --- | -------- | ------------------------- |
| 0x00 |   0 | 00------ | [uint6](#uint6)           |
| 0x40 |  64 | 01------ | [uint14](#uint14)         |
| 0x80 | 128 | 10000000 | RESERVED                  |
| 0x81 | 129 | 1000---- | [nint4](#nint4)           |
| 0x90 | 144 | 1001---- | [barray4](#barray4)       |
| 0xA0 | 160 | 101----- | [array5](#array5)         |
| 0xC0 | 192 | 110----- | [str5](#str5)             |
| 0xE0 | 224 | 11100000 | [false](#false)           |
| 0xE1 | 225 | 11100001 | [true](#true)             |
| 0xE2 | 226 | 11100010 | [null](#null)             |
| 0xE3 | 227 | 11100011 | [undefined](#undefined)   |
| 0xE4 | 228 | 11100100 | [uint16](#uint16)         |
| 0xE5 | 229 | 11100101 | [uint24](#uint24)         |
| 0xE6 | 230 | 11100110 | [uint32](#uint32)         |
| 0xE7 | 231 | 11100111 | [uint64](#uint64)         |
| 0xE8 | 232 | 11101000 | [nint8](#nint8)           |
| 0xE9 | 233 | 11101001 | [nint16](#nint16)         |
| 0xEA | 234 | 11101010 | [nint32](#nint32)         |
| 0xEB | 235 | 11101011 | [nint64](#nint64)         |
| 0xEC | 236 | 11101100 | [float32](#float32)       |
| 0xED | 237 | 11101101 | [double64](#double64)     |
| 0xEE | 238 | 11101110 | [timestamp](#timestamp)   |
| 0xEF | 239 | 11101111 | [binary\*](#binary)       |
| 0xF0 | 240 | 11110000 | [cstring](#cstring)       |
| 0xF1 | 241 | 11110001 | [str\*](#str)             |
| 0xF2 | 242 | 11110010 | [array\*](#array)         |
| 0xF3 | 243 | 11110011 | [barray\*](#barray)       |
| 0xF4 | 244 | 11110100 | [map](#map)               |
| 0xF5 | 245 | 11110101 | [bmap](#bmap)             |
| 0xF6 | 246 | 11110110 | RESERVED                  |
| 0xF7 | 247 | 11110111 | [extension\*](#extension) |
| 0xF8 | 251 | 11111--- | [extension3](#extension3) |


## Type Breakdown

#### Notational Conventions

* `0x00` represents a byte as the hexadecimal number following `0x`.
* `xxxxxxxx` represents a byte as 8 bits. Some `x`s may instead be `0` or `1`
  to indicate that those bits are fixed. Remaining `x` bits may be either `0`
  or `1`.
* Boxes with `--------` borders are drawn around one of the above single byte values.
* Boxes with `========` borders are drawn around zero or more bytes as described within.
* Boxes with `~~~~~~~~` borders are drawn around zero or more SuperPack encoded values.

### uint family

Stores a big-endian encoding of a non-negative integer in 1, 2, 3, 4, 5, or 9 bytes.

#### uint6

    +--------+
    |00xxxxxx|
    +--------+

An integer between 0 and 63.

#### uint14

    +--------+--------+
    |01xxxxxx|xxxxxxxx|
    +--------+--------+

An integer between 64 and 16,383 (2<sup>14</sup> - 1).

#### uint16

    +--------+--------+--------+
    |  0xE4  |xxxxxxxx|xxxxxxxx|
    +--------+--------+--------+

An integer between 16,384 and 65,535 (2<sup>16</sup> - 1).

#### uint24

    +--------+--------+--------+--------+
    |  0xE5  |xxxxxxxx|xxxxxxxx|xxxxxxxx|
    +--------+--------+--------+--------+

An integer between 65,536 and 16,777,215 (2<sup>24</sup> - 1).

#### uint32

    +--------+--------+--------+--------+--------+
    |  0xE6  |xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|
    +--------+--------+--------+--------+--------+

An integer between 16,777,216 and 4,294,967,295 (2<sup>32</sup> - 1).

#### uint64

    +--------+--------+--------+--------+--------+--------+--------+--------+--------+
    |  0xE7  |xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|
    +--------+--------+--------+--------+--------+--------+--------+--------+--------+

An integer between 4,294,967,296 and 2<sup>64</sup> - 1.

### nint family

Stores a big-endian encoding of the magnitude of a non-positive integer in 1,
2, 3, 5, or 9 bytes.

#### nint4

    +--------+
    |1000xxxx|
    +--------+

An integer between -1 and -15. The type tag 0x80 is reserved.

#### nint8

    +--------+--------+
    |  0xE8  |xxxxxxxx|
    +--------+--------+

An integer between -16 and -255.

#### nint16

    +--------+--------+--------+
    |  0xE9  |xxxxxxxx|xxxxxxxx|
    +--------+--------+--------+

An integer between -256 and -65,535.

#### nint32

    +--------+--------+--------+--------+--------+
    |  0xEA  |xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|
    +--------+--------+--------+--------+--------+

An integer between -65,536 and -4,294,967,295.

#### nint64

    +--------+--------+--------+--------+--------+--------+--------+--------+--------+
    |  0xEB  |xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|
    +--------+--------+--------+--------+--------+--------+--------+--------+--------+

An integer between -4,294,967,296 and -(2<sup>64</sup> - 1).

### float family

Stores an IEEE-754 floating point number in 5 or 9 bytes.

`s`, `e`, and `m` bits represent sign, exponent, and mantissa, respectively.

#### float32

    +--------+--------+--------+--------+--------+
    |  0xEC  |seeeeeee|emmmmmmm|mmmmmmmm|mmmmmmmm|
    +--------+--------+--------+--------+--------+

#### double64

    +--------+--------+--------+--------+--------+--------+--------+--------+--------+
    |  0xED  |seeeeeee|eeeemmmm|mmmmmmmm|mmmmmmmm|mmmmmmmm|mmmmmmmm|mmmmmmmm|mmmmmmmm|
    +--------+--------+--------+--------+--------+--------+--------+--------+--------+

### timestamp family

#### timestamp

Stores a timestamp (in milliseconds since 1970-01-01T00:00:00.000Z) in 7 bytes.
Essentially an `int48`. The first bit is the sign bit and the bytes are in
big-endian order.

    +--------+--------+--------+--------+--------+--------+--------+
    |  0xEE  |xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|
    +--------+--------+--------+--------+--------+--------+--------+

### simple values family

Stores `false`, `true`, `null`, or `undefined` in one byte.

#### false

    +--------+
    |  0xE0  |
    +--------+

#### true

    +--------+
    |  0xE1  |
    +--------+

#### null

    +--------+
    |  0xE2  |
    +--------+

#### undefined

    +--------+
    |  0xE3  |
    +--------+

### binary family

Stores a binary blob.

#### binary\*

    +--------+~~~~~~+=============+
    |  0xEF  | uint | binary data |
    +--------+~~~~~~+=============+

A binary blob of any `uint` number of bytes.

### string family

Stores a UTF-8 encoded string.

#### str5

    +--------+===========+
    |110xxxxx| utf8 data |
    +--------+===========+

A string of up to 31 UTF-8 bytes.

#### str\*

    +--------+~~~~~~+===========+
    |  0xF1  | uint | utf8 data |
    +--------+~~~~~~+===========+

A string of any `uint` number of UTF-8 bytes.

#### cstring

    +--------+===========+--------+
    |  0xF0  | utf8 data |  0x00  |
    +--------+===========+--------+

A null-terminated string of any number of UTF-8 bytes. The UTF-8 bytes must not
contain `0x00`.

### array family

#### array5

    +--------+~~~~~~~~+
    |101xxxxx| values |
    +--------+~~~~~~~~+

An array of up to 31 values.

#### array\*

    +--------+~~~~~~+~~~~~~~~+
    |  0xF2  | uint | values |
    +--------+~~~~~~+~~~~~~~~+

An array of any `uint` number of values.

#### barray4

    +--------+==========+
    |1001xxxx| booleans |
    +--------+==========+

An array of up to 15 boolean values.

The boolean values of the array are stored as one bit each, right-padded with
`0` bits to the next full byte if necessary. `true` is represented as a `1`
bit and `false` is represented as a `0` bit.

#### barray\*

    +--------+~~~~~~+==========+
    |  0xF3  | uint | booleans |
    +--------+~~~~~~+==========+

An array of any `uint` number of boolean values.

The boolean values of the array are stored as one bit each, right-padded with
`0` bits to the next full byte if necessary. `true` is represented as a `1`
bit and `false` is represented as a `0` bit.

### map family

Stores a map structure.

#### map

    +--------+~~~~~~+~~~~~~~~+
    |  0xF4  | keys | values |
    +--------+~~~~~~+~~~~~~~~+

A map whose keys are given by an array of strings. The strings in the array
must be unique. The values of the map follow in the same order as the keys.

#### bmap

    +--------+~~~~~~+==========+
    |  0xF5  | keys | booleans |
    +--------+~~~~~~+==========+

A boolean-valued map whose keys are given by an array of strings. The strings
in the array must be unique.

The boolean values of the map are stored as one bit each, right-padded with `0`
bits to the next full byte if necessary, in the same order as the keys. `true`
is represented as a `1` bit and `false` is represented as a `0` bit.

### extension family

Represents an otherwise unsupported value in terms of a supported value,
identified by the extension point. For more information, see [Extensions](#extensions).

#### extension3

    +--------+~~~~~~~+
    |11111xxx| value |
    +--------+~~~~~~~+

An extension point between 0 and 7 followed by any SuperPack value.

#### extension\*

    +--------+~~~~~~+~~~~~~~+
    |  0xF7  | uint | value |
    +--------+~~~~~~+~~~~~~~+

A `uint` extension point followed by any SuperPack value.

## Extensions

SuperPack encoders should provide an interface for a consumer to specify a
serialisation and deserialisation mechanism for a given type of data. For
example, since SuperPack does not have built-in support for representation of
regular expressions, a regular expression may instead be represented as a
two-element array containing its source and flags. When the SuperPack value
that represents this intermediate value is decoded, it will be converted back
to a regular expression.

```js
let transcoder = new SuperPackTranscoder;
transcoder.extend(
  // extension point
  0,
  class {
    // detect values which require this custom serialisation
    isCandidate(x) { return x instanceof RegExp; },
    // return an intermediate value which will be encoded instead
    serialise(r) { return [r.source, r.flags]; },
    // from the intermediate value, reconstruct the original value
    deserialise([source, flags]) { return RegExp(source, flags); },
  }
);
```

If the extension uses state to keep track of values it has marked as
candidates, it can use that state in conjunction with the optional
`shouldSerialise` method to determine if an extension should be applied to the
value. `shouldSerialise` will only ever be called once all candidates have been
determined (see Extensions and Recursion for an exception to this). This is
useful for optimisations that need to see all of the data being encoded before
being effective. Most extensions will always return `true` from this function.

### Extension memos

Extension memos allow for the storage of a side table used in the decoding of
values encoded by an extension. This is mostly useful for deduplication and
optimisation.

```js
// preserves ECMAScript Symbol identity and description
class SymbolExtension {
  constructor() {
    this.symbols = [];
  }
  isCandidate(x) {
    return typeof x === 'symbol' || x && x.constructor === Symbol;
  }
  serialise(s) {
    let i = this.symbols.indexOf(s);
    if (i >= 0) return i;
    return this.symbols.push(s) - 1;
  }
  deserialise(n, memo) {
    if (this.symbols[n] == null) {
      let s = Symbol(memo[n]);
      this.symbols[n] = s;
      return s;
    }
    return this.symbols[n];
  }
  memo() { return this.symbols.map(sym => String(sym).slice(7, -1)); }
}

let encoded = encode(data, { extensions: { 0: SymbolExtension } });
```

Memos are encoded and prepended to the SuperPack payload in descending
extension point order. Memos are only prepended for extensions that indicate
that they require a memo. During the encoding of a memo, extensions that use a
memo must not be applied if their extension point is greater than that of the
extension whose memo is being encoded.

#### Examples

* String deduplication
* Map keyset deduplication
* Representation of values with identity
* Deduplication of common integers, timestamps, floats, or other potentially large data types

... and many domain-specific usages.

#### Precautions

As with any compression-like scheme, highly-compressed inputs which result in a
much larger decoded value are a concern. SuperPack decoders are advised to
assume that their input is potentially adversarial and be resistant to attacks
based on expansion.

### Extensions and Recursion

Some extensions will serialise to values which could have themselves been
identified as a candidate for applying the extension. In most cases, it is not
desirable to apply the extension again to the serialised value, and by default,
this is how a SuperPack encoder will work. But for some extensions, the
recursion is desirable, and those extensions may supply a
`shouldApplyRecursively` function which returns `true` to opt in to this
behaviour. Be very careful when writing extensions that utilise this
functionality, as it can easily lead to infinite recursion.
