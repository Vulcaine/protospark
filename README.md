# ⭐ Protospark ⭐

**Protospark** is a way to serialize/deserialize **protocol buffer** messages easily in a type safe manner.
This module is an abstraction on top of the **protobufjs**

## Installation

---

**npm**

```bash
> npm install protospark
```

```javascript
const protospark = require("protospark");
```

**Please note:** This package does not include a feature to generate JavaScript files from Protocol Buffer (.proto) files. For this purpose, **you should utilize the protobufjs-cli package**.

## Usage

---

**Note:** for protospark to infer the type correctly, every message must contain a 'type' property.

```
// message.proto
message MyAwesomeMessage {
  string type = 1;
  string some_field = 2;
}
```

```javascript
const protospark = require("protospark");
const options = { verifyByDefault: true };
const codec = protospark.ProtosparkCodec.fromPath(
  "some/directory/to/proto/files",
  options
);
const buffer = codec
  .encode({
    type: "MyAwesomeMessage",
    someField: "Hello World",
  })
  .finish();
const decoded = codec.decode(MyAwesomeMessage, buffer);
```

### Load from string

Protospark is able to compile schema from string as well:

```javascript
const protospark = require("protospark");
const options = { verifyByDefault: true };
const codec = protospark.ProtosparkCodec.fromString(
  `syntax="proto3";

   message MyAwesomeMessage {
    string type = 1;
    string some_field = 2;
   }`,
  options
);
const buffer = codec
  .encode({
    type: "MyAwesomeMessage",
    someField: "Hello World",
  })
  .finish();
const decoded = codec.decode(MyAwesomeMessage, buffer);
```

## Additional notes

If you are missing some features, you can leverage the full functionality of the protobufjs schema with `codec.rawSchema()`.
