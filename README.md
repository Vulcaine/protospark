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

## 2.0, whats new?

- Predictive encoding and decoding
- - With this approach, we accept a slight performance overhead to facilitate easier type inference.
- On-the-fly generation of proto/JS files from schema definitions defined in code.

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

### --- OR ---

Define the javascript entity in code as well:

```javascript
class MyAwesomeMessage {
  type;
  someField;
}
```

The method above is somewhat impractical as it requires defining the same schema twice, but it remains a viable option. Alternatively, leveraging the new 2.0 features could automate the generation of message types.

### Example of creating a simple encoder and decoder

```javascript
const protospark = require("protospark");
const options = { ... options here ... };
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
const options = { ... options here ... };
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

## ✨ NEW ✨ Protobuf schema generation in javascript

---

This functionality allows the creation of protobuf schemas using JavaScript entities, introducing `inheritance` which is not inherent to the protocol buffer standard.

**!!!IMPORTANT!!!** Recommended to use with TypeScript

**To utilize this feature, please keep in mind the following restrictions:**

- Every entity must extend the `ProtosparkSchemaDefinition` class.
- Defining empty schemas are not permitted.
- Redefining properties within schemas is prohibited.

### Usage

**1. Begin with a non-empty schema definition:**

The structure of the definition is recommended to be the following:

```javascript
class <SchemaName>SchemaDefinition extends ProtosparkSchemaDefinition {
    <parameterName>[: ProtosparkSchemaTypeDescription] = { type: ProtosparkSchemaPropertyType.<typeName> }
}
```

Where:

- `<SchemaName>`: The name of the desired message schema
- `<parameterName>`: The parameter name in **camelCase**
- `<typeName>`: Property of `ProtosparkSchemaPropertyType`

**Example:**

```javascript
class MySchemaDefinition extends ProtosparkSchemaDefinition {
  someProperty = { type: ProtosparkSchemaPropertyType.bool };
  // .. add more properties
}

class MySubSchemaDefinition extends MySchemaDefinition {
  additionalProperty = { type: ProtosparkSchemaPropertyType.string };
  // add more properties
}
```

**Note:** `ProtosparkSchemaPropertyType` aims to offer support for a broad set of types, although it is still a work in progress and undergoes continuous development.

**2. Define the schema:**

```javascript
const MySchema = ProtosparkSchema.defineMultiple([
  MySchemaDefinition,
  MySubSchemaDefinition,
]);
```

This schema will contain the "someProperty"

**3. Generate the proto file from the defined schemas:**

```javascript
// pass all the defined schemas here that you wish in one file.
const options = {
  format: "ts", // this is the default, use "ts" for typescript generation
};

const environment = protospark.ProtosparkSchemaGenerator.generate(MySchema);

// do anything with the file.. for example load in memory:
const inMemoryCodec = ProtosparkCodec.fromProtoFile(environment.file);

// Or compile it into javascript to use the message types:
// !!!!IMPORTANT: Setup generation in a different script
environment.write("./generated", "test", options);

import { MyMessage } from "./generated/test";
const encoded = inMemoryCodec
  .encode({
    type: MyMessage.name,
    someProperty: true,
  })
  .execute()
  .finish();

const decoded = inMemoryCodec.decode(encoded).to(MyMessage);
console.log(decoded); // MyMessage { type: 'MyMessage', someProperty: true }

// Alternatively, to save only the proto file:
// environment.file.write(ProtoFileOutDir, fileNameWithProtoExtension);

const regularCodec = protospark.ProtosparkCodec.fromPath(ProtoFileOutDir);
```

**!!!IMPORTANT!!!** Prior to utilizing the generated files, ensure the generation process has been completed. It's advisable to establish a distinct generation script that can be executed preceding the application's execution.

## ✨ NEW ✨ Predictive decoding

---

If you're seeking a method to bypass specifying the output type for the decode method, you can accomplish this using the new predictive decoding feature:

```javascript
// ...
// Create schemas from the definitions
const MySchemas = ProtosparkSchema.defineMultiple([
  TestSchemaDefinition,
  Test2SchemaDefinition,
]);
// Generate the environment from the schemas
const environment = ProtosparkSchemaGenerator.generate(MySchemas);
// encode something with the predictive algorithm, { verify: true } is default by the way
const encoded = codec.encode(message, { verify: true }).predictive();
// decode in a predictive way, supply the enviroment to the encoder to help infering the types
const decoded = codec.decode(encoded).predictive(environment);
// ...
```

**This feature is having the following limitations:**

- The initial 32 bytes of the buffer must represent the type parameter in hexadecimal format.
- The length of the type parameter cannot exceed 32 bytes, which should provide ample space for this parameter.
- Expect an overhead increase, although ignorable, it's important to acknowledge.

### Options

You can provide these options when creating the codec: `protospark.ProtosparkCodec.fromPath(path, options)`

| option                       | description                                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PredictiveDecodeOptions.algo | The symmetric encryption algorithm e.g. "aes-256-cbc". `The default value is: "aes-256-cbc"`                                                                                                |
| PredictiveDecodeOptions.key  | The secret key for the algorithm, specifying this parameter is not necessary. It has been provided for the sake of completeness. `The default value is: "protospark-public-secret32-bytes"` |
| PredictiveDecodeOptions.iv   | The iv for the algorithm, by default protospark will use a random one. If you wish a consistent decoder, please generate a fixed iv manually and provide this option                        |

## Additional notes

The package continues to evolve over time. If you find yourself in need of additional features, you can harness the complete functionality of the protobufjs schema with `codec.rawSchema()`.
