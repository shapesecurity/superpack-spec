# SuperPack

SuperPack is a data serialisation format. Due to its design and its [optional optimisations](#optimisations),
it is particularly suitable for encoding values with repeated structure: arrays
of booleans, strings used more than once, objects which have the same shape,
etc.

A comparison of schemaless serialisation formats:

| name                                                                 | encoded size | LZMA compressed | extensible | rich built-in types | human-readable |
| -------------------------------------------------------------------- | -----------: | --------------: | ---------- | ------------------- | -------------- |
| *SuperPack*                                                          |        4572B |           2537B | YES        | no                  | no             |
| [Sereal](https://github.com/Sereal/Sereal)                           |        6487B |           2868B | YES        | no                  | no             |
| [MessagePack](http://msgpack.org)                                    |        7797B |           2599B | YES        | no                  | no             |
| [CBOR](http://cbor.io/)                                              |        7802B |           2575B | YES        | YES                 | no             |
| [bencode](https://wiki.theory.org/BitTorrentSpecification#Bencoding) |        9932B |           2589B | no         | no                  | arguably       |
| [BSON](http://bsonspec.org/)                                         |       11757B |           3097B | YES        | YES                 | no             |
| [edn](https://github.com/edn-format/edn)                             |       12543B |           2604B | YES        | no                  | YES            |
| [JSON](http://www.json.org/)                                         |       12636B |           2628B | no         | no                  | arguably       |

SuperPack is designed to

  * achieve a small encoded payload size
  * have a reasonably small transcoder
  * encode data of an (a priori) unknown schema
  * transcode arbitrary data types without consulting the SuperPack authors through [extension](#extension)
  * operate in an environment without access to a lossless data compression algorithm


## Overview

### Terminology and Requirements

The SuperPack format specifies 255 *type tags* for representing values of various data types.

A *SuperPack value* starts with a type tag and can be encoded or decoded without backtracking.

A *SuperPack payload* is a byte sequence representing one *SuperPack value*.

A SuperPack encoder is a function from a value to a SuperPack payload.
A SuperPack decoder is a function from a SuperPack payload to a value.

The SuperPack format allows for two optional optimisations: the *repeated string optimisation* and the *repeated keyset optimisation*. Since some values do not benefit from these optimisations, a *SuperPack payload* can have two forms:

- Simple: the byte array contains just the value; neither optimisation is used.
- Optimised: the byte array contains multiple parts which are used to reconstruct the value; one or both optimisations MAY be used. See the [Optimisations](#optimisations) section for more details on the optimised form.

It is considered somewhat more complex to encode to the optimised form than to the simple form, but it remains comparatively easy to decode optimised form payloads.
Additionally, an encoder can still be a total function without supporting the optimised form, but a decoder cannot be a total function without supporting it. As a result,

- Encoders SHOULD support the optimised form to make best use of the SuperPack format
- Encoders MAY forego optimisations for simplicity (i.e. always use the simple form)
- Decoders MUST support decoding both the simple and optimised forms

SuperPack also supports efficient storage of booleans in boolean-valued homogeneous structures via the `barray` and `bmap` types. Encoders SHOULD support these types, and decoders MUST support decoding them.

The keys of `map` and `bmap` values MUST be strings (like JSON) and they MUST be unique (unlike JSON). This simplifies the repeated keyset optimisation process and allows it to benefit from the repeated string optimisation.

### Type tags

| Hex  | Dec | Binary   | Tag Name                |
| ---- | --- | -------- | ----------------------- |
| 0x00 |   0 | 00------ | [uint6](#uint6)         |
| 0x40 |  64 | 01------ | [uint14](#uint14)       |
| 0x80 | 128 | 1000---- | [nint4](#nint4)         |
| 0x90 | 144 | 1001---- | [barray4](#barray4)     |
| 0xA0 | 160 | 101----- | [array5](#array5)       |
| 0xC0 | 192 | 110----- | [str5](#str5)           |
| 0xE0 | 224 | 11100000 | [false](#false)         |
| 0xE1 | 225 | 11100001 | [true](#true)           |
| 0xE2 | 226 | 11100010 | [null](#null)           |
| 0xE3 | 227 | 11100011 | [undefined](#undefined) |
| 0xE4 | 228 | 11100100 | [uint16](#uint16)       |
| 0xE5 | 229 | 11100101 | [uint24](#uint24)       |
| 0xE6 | 230 | 11100110 | [uint32](#uint32)       |
| 0xE7 | 231 | 11100111 | [uint64](#uint64)       |
| 0xE8 | 232 | 11101000 | [nint8](#nint8)         |
| 0xE9 | 233 | 11101001 | [nint16](#nint16)       |
| 0xEA | 234 | 11101010 | [nint32](#nint32)       |
| 0xEB | 235 | 11101011 | [nint64](#nint64)       |
| 0xEC | 236 | 11101100 | [float32](#float32)     |
| 0xED | 237 | 11101101 | [double64](#double64)   |
| 0xEE | 238 | 11101110 | [timestamp](#timestamp) |
| 0xEF | 239 | 11101111 | [binary\*](#binary)     |
| 0xF0 | 240 | 11110000 | [cstring](#cstring)     |
| 0xF1 | 241 | 11110001 | [str8](#str8)           |
| 0xF2 | 242 | 11110010 | [str\*](#str)           |
| 0xF3 | 243 | 11110011 | [strref](#strref)       |
| 0xF4 | 244 | 11110100 | [array8](#array8)       |
| 0xF5 | 245 | 11110101 | [array\*](#array)       |
| 0xF6 | 246 | 11110110 | [barray8](#barray8)     |
| 0xF7 | 247 | 11110111 | [barray\*](#barray)     |
| 0xF8 | 248 | 11111000 | [map](#map)             |
| 0xF9 | 249 | 11111001 | [bmap](#bmap)           |
| 0xFA | 250 | 11111010 | [mapl](#mapl)           |
| 0xFB | 251 | 11111011 | [bmapl](#bmapl)         |
| 0xFC | 252 | 11111100 | unused                  |
| 0xFD | 253 | 11111101 | unused                  |
| 0xFE | 254 | 11111110 | [opts](#optimisations)  |
| 0xFF | 255 | 11111111 | [extension](#extension) |


## Type Breakdown

#### Notational Conventions

* `0x00` represents a byte as the hexadecimal number following `0x`.
* `xxxxxxxx` represents a byte as 8 bits. Some `x`s may instead be `0` or `1` to indicate that those bits are fixed. Remaining `x` bits may be either `0` or `1`.
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

An integer between 0 and 16,383 (2^14 - 1).

#### uint16

    +--------+--------+--------+
    |  0xE4  |xxxxxxxx|xxxxxxxx|
    +--------+--------+--------+

An integer between 0 and 65,535 (2^16 - 1).

#### uint24

    +--------+--------+--------+--------+
    |  0xE5  |xxxxxxxx|xxxxxxxx|xxxxxxxx|
    +--------+--------+--------+--------+

An integer between 0 and 16,777,215 (2^24 - 1).

#### uint32

    +--------+--------+--------+--------+--------+
    |  0xE6  |xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|
    +--------+--------+--------+--------+--------+

An integer between 0 and 4,294,967,295 (2^32 - 1).

#### uint64

    +--------+--------+--------+--------+--------+--------+--------+--------+--------+
    |  0xE7  |xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|
    +--------+--------+--------+--------+--------+--------+--------+--------+--------+

An integer between 0 and 2^64 - 1.

### nint family

Stores a big-endian encoding of the magnitude of a non-positive integer in 1, 2, 3, 5, or 9 bytes.

#### nint4

    +--------+
    |1000xxxx|
    +--------+

An integer between 0 and -15.

#### nint8

    +--------+--------+
    |  0xE8  |xxxxxxxx|
    +--------+--------+

An integer between 0 and -255.

#### nint16

    +--------+--------+--------+
    |  0xE9  |xxxxxxxx|xxxxxxxx|
    +--------+--------+--------+

An integer between 0 and -65535.

#### nint32

    +--------+--------+--------+--------+--------+
    |  0xEA  |xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|
    +--------+--------+--------+--------+--------+

An integer between 0 and -4294967295.

#### nint64

    +--------+--------+--------+--------+--------+--------+--------+--------+--------+
    |  0xEB  |xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|xxxxxxxx|
    +--------+--------+--------+--------+--------+--------+--------+--------+--------+

An integer between 0 and -(2^64 - 1).

### float family

Stores a floating point number in 5 or 9 bytes.

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

Stores a timestamp (in milliseconds since 1970-01-01T00:00:00.000Z) in 7 bytes. Essentially an `int48`. The first bit is the sign bit and the the bytes are in big-endian order.

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

### binary\*

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

#### str8

    +--------+--------+===========+
    |  0xF1  |xxxxxxxx| utf8 data |
    +--------+--------+===========+

A string of up to 255 UTF-8 bytes.

#### str\*

    +--------+~~~~~~+===========+
    |  0xF2  | uint | utf8 data |
    +--------+~~~~~~+===========+

A string of any `uint` number of UTF-8 bytes.

#### cstring

    +--------+===========+--------+
    |  0xF0  | utf8 data |  0x00  |
    +--------+===========+--------+

A null-terminated string of any number of UTF-8 bytes. The UTF-8 bytes must not contain `0x00`.

#### strref

    +--------+--------+
    |  0xF1  |xxxxxxxx|
    +--------+--------+

The string at index `xxxxxxxx` in the string lookup table.

See also: [Repeated String Optimisation](#repeated-string-optimisation)

### array family

#### array5

    +--------+~~~~~~~~+
    |101xxxxx| values |
    +--------+~~~~~~~~+

An array of up to 31 values.

#### array8

    +--------+--------+~~~~~~~~+
    |  0xF4  |xxxxxxxx| values |
    +--------+--------+~~~~~~~~+

An array of up to 255 values.

#### array\*

    +--------+~~~~~~+~~~~~~~~+
    |  0xF5  | uint | values |
    +--------+~~~~~~+~~~~~~~~+

An array of any `uint` number of values.

#### barray4

    +--------+==========+
    |1001xxxx| booleans |
    +--------+==========+

An array of up to 15 boolean values.

Those boolean values are stored as one bit each, right-padded with `0` bits to the next full byte if necessary.
`true` is represented as a `1` bit and `false` is represented as a `0` bit.

#### barray8

    +--------+--------+==========+
    |  0xF6  |xxxxxxxx| booleans |
    +--------+--------+==========+

An array of up to 255 boolean values.

Those boolean values are stored as one bit each, right-padded with `0` bits to the next full byte if necessary.
`true` is represented as a `1` bit and `false` is represented as a `0` bit.

#### barray\*

    +--------+~~~~~~+==========+
    |  0xF7  | uint | booleans |
    +--------+~~~~~~+==========+

An array of any `uint` number of boolean values.

Those boolean values are stored as one bit each, right-padded with `0` bits to the next full byte if necessary.
`true` is represented as a `1` bit and `false` is represented as a `0` bit.

### map family

Stores a map structure.

#### map

    +--------+~~~~~~+~~~~~~~~+
    |  0xF8  | uint | values |
    +--------+~~~~~~+~~~~~~~~+

A map whose keyset is the `uint` index of the keyset table.

The values are stored in the same order as the keys.

See also: [Repeated Keyset Optimisation](#repeated-keyset-optimisation)

#### bmap

    +--------+~~~~~~+~~~~~~~~+
    |  0xF9  | uint | values |
    +--------+~~~~~~+~~~~~~~~+

A boolean-valued map whose keyset is the `uint` index of the keyset table.

Those boolean values are stored as one bit each, right-padded with `0` bits to the next full byte if necessary, in the same order as the keys.
`true` is represented as a `1` bit and `false` is represented as a `0` bit.

See also: [Repeated Keyset Optimisation](#repeated-keyset-optimisation)

#### mapl

Map literal, for implementations which do not use repeated keyset optimisation. Format TBD.

#### bmapl

Boolean-valued map literal, for implementations which do not use repeated keyset optimisation. Format TBD.

### extension family

#### extension\*

    +--------+--------+~~~~~~+======+
    |  0xFF  |xxxxxxxx| uint | data |
    +--------+--------+~~~~~~+======+

Specifies an extension type tag `xxxxxxxx`, followed by a `uint` length, followed by zero or more bytes of data.

Encoders are expected to provide an interface for a consumer to specify a serialisation and deserialisation mechanism for a given type of data.

```js
SuperPackTranscoder.extend(
  // extension point: 0 through 127
  0,
  // detect values which require this custom serialisation
  x => x instanceof RegExp,
  // serialiser: return an intermediate value which will be encoded instead
  r => [r.pattern, r.flags],
  // deserialiser: from the intermediate value, reconstruct the original value
  ([pattern, flags]) => RegExp(pattern, flags),
);
```

The extension ranges are reserved as follows:

* Extension points 0-127 are available for user-specified extension types.
* Extension points 128-255 are currently reserved for future spec additions.


## Optimisations

The SuperPack spec supports two optimisations: the *repeated string optimisation* and the *repeated keyset optimisation*. These are enabled by the string lookup table and the keyset lookup table.

If the first byte of a payload **is not** the `opts` type tag, the payload does not use repetition optimisations and consists of just one part, the encoded data value.

    +~~~~~~~+
    | value |
    +~~~~~~~+

If the first byte of a payload **is** the `opts` type tag, the payload uses repetition optimisations, and is constructed from the following parts concatenated together:

    +--------+~~~~~~~~~~~~~~~~~~~~~+~~~~~~~~~~~~~~~~~~~~~+~~~~~~~+
    |  0xFE  | string lookup table | keyset lookup table | value |
    +--------+~~~~~~~~~~~~~~~~~~~~~+~~~~~~~~~~~~~~~~~~~~~+~~~~~~~+

0. The `opts` type tag, `0xFE`.
1. The *string lookup table*, for repeated string optimisation. This value is an `array8` (sans type tag) containing strings which occur at least twice in the parts that follow. If the repeated keyset optimisation is used but the string lookup table is empty, it must be explicitly included as the length `0`.

        +--------+~~~~~~~~~+
        |xxxxxxxx| strings |
        +--------+~~~~~~~~~+

2. The *keyset lookup table*, for repeated keyset optimisation, possibly containing references to (1). This value is an array of any length, containing any number of arrays of strings, each such array representing an ordered keyset and containing no repeated strings. If the repeated string optimisation is used but the keyset lookup table is empty, it must be explicitly included as an empty array.
3. The *encoded value*, possibly containing references to (1) and (2). This can be of any type.

The `opts` type tag MUST NOT be used anywhere else except for at the beginning of an optimised form payload.

We might like for an encoder to always output the shortest possible payload for a given value, whichever form that may be. The most accurate way to determine this is to encode the input value to both forms and return the shorter one, but this is rather laborious. Much simpler determinations can be correct in almost all cases, and an optimised form payload will almost never be more than a few bytes larger than the equivalent simple form payload. For these reasons, the spec writers consider it reasonable to use the optimised form whenever the payload contains a map or repeated string, and to use the simple form otherwise. This rule of thumb allows for some uncommon cases where the optimised form is used when the simple form would be smaller, but it allows for a much easier determination, will never miss an optimisation, and still avoids using the optimised form when it just adds an obviously-useless 3-byte prefix of `opts 0 array5` to the equivalent simple form.

### Repeated String Optimisation

The string lookup table stores strings which occur multiple times, allowing them to be referenced by the `strref` type tag so repeated instances each take constant space regardless of the size of the string.

Specifically, the string lookup table has a maximum size of 255, so as to guarantee that a string reference requires only two bytes.

### Repeated Keyset Optimisation

TODO: explain

### Precautions

As with any compression-like scheme, highly-compressed inputs which result in a much larger decoded value are a concern.

For SuperPack payloads crafted for maximum expansion, the following relationships between input size and expanded size hold:

| Input Size | Expanded Size |
| ---------- | ------------- |
| 1kB        | 125kB         |
| 2kB        | 500kB         |
| 2.83kB     | 1mB           |
| 4kB        | 2mB           |
| 40kB       | 200mB         |
| 400kB      | 20gB          |

In general, doubling the size of the payload will quadruple the potential size of the expanded value, and a `b`-byte input will expand to `(b * b) / 8` bytes.

The general form of a maximally-expanding payload is an array of `b/4` copies of a single string of length `b/2`. The repeated string optimisation allows each copy to require only 2 bytes, so the payload encodes to `(b / 4) * 2` bytes for the array and `b/2` bytes for the string, plus a few bytes of constant overhead. Thus, we have a `b`-byte input expanding to `(b / 4) * (b / 2)` bytes.

A similar expansion can be done using just the repeated keyset optimisation, but it is less efficient, expanding `b` bytes to `(b * b) / 12` bytes.

There's no way to achieve greater expansion by stacking the two optimisations, largely because SuperPack maps have unique keys. The closest structure using both optimisations would be an array of 1-element maps, each mapping the same particular long string to itself. This would use 4 bytes per such map (1 byte map type tag, 1 byte keyset index, 2 bytes string reference), achieving no greater efficiency than replacing each map with two copies of that string, which leads to the `(b * b) / 8` expansion described above.

SuperPack decoders SHOULD assume their input is potentially adversarial and be resistant to this expansion attack.
