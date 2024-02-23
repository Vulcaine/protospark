# ⭐ Protospark 2.0 ⭐

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

**Notes:**

- for protospark to infer the type correctly, every message must contain a 'type' property.
- encoding by default verifying the schema, to disable it, supply the `{ verify: false }` option for the encoder.

```
// message.proto
message MyAwesomeMessage {
  string type = 1;
  string some_field = 2;
}
```

Important first step is to compile the proto file using the protobufjs-cli, see:
[protobufjs-cli](https://www.npmjs.com/package/protobufjs)

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
  .execute()
  .finish();
const decoded = codec.decode(buffer).to(MyAwesomeMessage);
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
  .execute()
  .finish();
const decoded = codec.decode(buffer).to(MyAwesomeMessage);
```

## ✨ NEW ✨ Predictive decoding

---

If you looking for a way to avoid specifying the output type for the decode method, you can achieve this with the new predictive decoding feature:

```javascript
// ...
const encoded = codec.encode(message, { verify: true }).predictive();
const decoded = codec.decode(encoded).predictive();
// ...
```

**This feature having the following limitations:**

- The initial 32 bytes of the buffer must represent the type parameter in hexadecimal format.
- The length of the type parameter cannot exceed 32 bytes, which should provide ample space for this parameter.
- Expect an overhead increase for decoding, although usually negligible, it's important to acknowledge.

### Options

You can provide these options when creating the codec: `protospark.ProtosparkCodec.fromPath(path, options)`

| option                       | description                                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PredictiveDecodeOptions.algo | The symmetric encryption algorithm e.g. "aes-256-cbc". `The default value is: "aes-256-cbc"`                                                                                                |
| PredictiveDecodeOptions.key  | The secret key for the algorithm, specifying this parameter is not necessary. It has been provided for the sake of completeness. `The default value is: "protospark-public-secret32-bytes"` |
| PredictiveDecodeOptions.iv   | The iv for the algorithm, by default protospark will use a random one. If you wish a consistent decoder, please generate a fixed iv manually and provide this option                        |

## ✨ NEW ✨ Protobuf schema generation in javascript

---

This functionality allows the creation of protobuf schemas using JavaScript entities, introducing `inheritance`` which is not inherent to the protocol buffer standard.

**To utilize this feature, please keep in mind the following restrictions:**

- Every entity must extend the `ProtosparkSchemaDefinition` class.
- Defining empty schemas are not permitted.
- Redefining properties within schemas is prohibited.

### Usage

**1. Begin with an empty schema definition:**

The structure of the schema definition is recommended to be the following:

```javascript
class <SchemaName>SchemaDefinition extends ProtosparkSchemaDefinition {
    readonly <parameterName> = { type: ProtosparkPropertyType.<typeName> }
}
```

Where:

- `<SchemaName>`: The name of the desired message schema
- `<parameterName>`: The parameter name in camel-case
- `<typeName>`: Property of `ProtosparkPropertyType`

**Example:**

```javascript
class MySchemaDefinition extends ProtosparkSchemaDefinition {
    readonly someProperty = { type: ProtosparkPropertyType.bool };
    // .. add more properties
}

class MySubSchemaDefinition extends ProtosparkSchemaDefinition {
    readonly additionalProperty = { type: ProtosparkPropertyType.string };
    // add more properties
}
```

**Note:** Schema definitions themselves cannot contain properties.

**2. Define the schema:**

```javascript
const MySchema = ProtosparkSchema.define(MySchemaDefinition);
```

This schema will contain the "someProperty"

**3. Generate the proto file from the defined schemas:**

```javascript
// pass all the defined schemas here that you wish in one file.
const protoFile = SchemaGenerator.generate([MySchema]);

// do anything with the file.. for example load in memory:
const inMemoryCodec = protospark.ProtosparkCodec.fromProtoFile(file, options);

// Or save in file, compile it into javascript and use as usual.
protoFile.write(ProtoFileOutDir, fileName);
// Don't forget to compile the generated proto files with the protobufjs-cli
const regularCodec = protospark.ProtosparkCodec.fromPath(ProtoFileOutDir);
```

## Additional notes

If you are missing some features, you can leverage the full functionality of the protobufjs schema with `codec.rawSchema()`.
