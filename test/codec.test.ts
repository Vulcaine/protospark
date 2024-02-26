import protobuf from "protobufjs";
import fs from "fs";
import { ProtobufCodec } from "../codec";
import path from "path";
import {
  PropertyType,
  Schema,
  SchemaDefinition,
  SchemaGenerator,
  SchemaTypeDescription,
  SchemaEnvironment,
} from "../schema";

class TestSchemaDefinition extends SchemaDefinition {
  readonly testParamString: SchemaTypeDescription = {
    type: PropertyType.string,
  };

  readonly testParamBool: SchemaTypeDescription = {
    type: PropertyType.bool,
  };
}

class TestNestedSchemaDefinition extends SchemaDefinition {
  readonly testNestedParam: SchemaTypeDescription = {
    type: TestSchemaDefinition,
  };
}

class TestExtendedSchemaDefinition extends TestSchemaDefinition {
  readonly additionalParam: SchemaTypeDescription = {
    type: PropertyType.bool,
  };
}

class TestMessage extends protobuf.Message {
  readonly testParamString: string;
  readonly testParamBool: boolean;
}

class TestNestedMessage extends protobuf.Message {
  readonly testNestedParam: TestMessage;
}

class TestExtendedMessage extends TestMessage {
  readonly additionalParam: boolean;
}

describe("Performance", () => {
  const thresholdMs = 5;
  it("encode+decode should be fast with non-predictive method", () => {
    class TestMessage extends protobuf.Message {
      readonly testParamString: string;
      readonly testParamBool: boolean;
    }
    const TestSchema = Schema.define(TestSchemaDefinition);
    const schemaEnvironment = SchemaGenerator.generate([TestSchema]);
    const codec = ProtobufCodec.fromProtoFile(schemaEnvironment.file);
    const expected = {
      type: TestMessage.name,
      testParamString: "Hello",
      testParamBool: false,
    };
    const times = 1000;
    let runtime = 0;
    let start = Date.now();
    for (let i = 0; i < times; i++) {
      const encoded = codec
        .encode({
          type: TestMessage.name,
          testParamString: "Hello",
          testParamBool: false,
        })
        .execute()
        .finish();
      codec.decode(encoded).to(TestMessage);
      runtime += Date.now() - start;
      start = Date.now();
    }
    const maxMs = 30;
    expect(runtime + thresholdMs <= maxMs).toBeTruthy();
  });
});

describe("Schema", () => {
  it("should generate the correct schema", () => {
    const TestSchema = Schema.define(TestSchemaDefinition);
    const schemaEnvironment = SchemaGenerator.generate([TestSchema]);
    const expectedContent =
      'syntax="proto3";\n' +
      "\n" +
      "\n" +
      "message TestMessage {\n" +
      "  string type = 1;\n" +
      "  string test_param_string = 2;\n" +
      "  bool test_param_bool = 3;\n" +
      "}\n" +
      "\n";
    expect(schemaEnvironment.file.content).toEqual(expectedContent);
  });

  it("should be able to encode, decode with the generated schema successfully", () => {
    class TestMessage extends protobuf.Message {
      readonly testParamString: string;
      readonly testParamBool: boolean;
    }

    const TestSchema = Schema.define(TestSchemaDefinition);
    const schemaEnvironment = SchemaGenerator.generate([TestSchema]);
    const codec = ProtobufCodec.fromProtoFile(schemaEnvironment.file);

    const expected = {
      type: TestMessage.name,
      testParamString: "Hello",
      testParamBool: false,
    };
    const encoded = codec
      .encode({
        type: TestMessage.name,
        testParamString: "Hello",
        testParamBool: false,
      })
      .execute()
      .finish();
    const decoded = codec.decode(encoded).to(TestMessage);
    expect(decoded).toEqual(expected);
  });

  it("should be able to write out the protofile", () => {
    const TestSchema = Schema.define(TestSchemaDefinition);
    const schemaEnvironment = SchemaGenerator.generate([TestSchema]);
    const outdir = "./test/gen/proto";
    const filename = "test.proto";
    const fullpath = path.resolve(path.join(outdir, filename));

    schemaEnvironment.file.write(outdir, filename);
    const exists = fs.existsSync(fullpath);
    expect(exists).toBeTruthy;
  });

  it("should work with nested types", () => {
    const TestSchemas = Schema.defineMultiple([
      TestSchemaDefinition,
      TestNestedSchemaDefinition,
    ]);
    const schemaEnvironment = SchemaGenerator.generate(TestSchemas);
    const codec = ProtobufCodec.fromProtoFile(schemaEnvironment.file);

    const data = {
      type: TestNestedMessage.name,
      testNestedParam: {
        testParamString: "Hello",
        testParamBool: true,
      },
    };

    const encoded = codec.encode(data).execute().finish();
    const decoded = codec.decode(encoded).to(TestNestedMessage);
    console.log(decoded["testNestedParam"]);
    expect(decoded["type"]).toBeTruthy();
    expect(decoded["testNestedParam"]).toEqual(data["testNestedParam"]);
    expect(decoded["type"]).toEqual(data["type"]);
  });

  it("should work with inheritance", () => {
    const TestSchemas = Schema.defineMultiple([
      TestSchemaDefinition,
      TestExtendedSchemaDefinition,
    ]);
    const schemaEnvironment = SchemaGenerator.generate(TestSchemas);
    const codec = ProtobufCodec.fromProtoFile(schemaEnvironment.file);

    const data = {
      type: TestExtendedMessage.name,
      testParamString: "Hello",
      testParamBool: true,
      additionalParam: true,
    };
    const expectedBaseClassData = {
      type: TestMessage.name,
      testParamString: "Hello",
      testParamBool: true,
    };

    const encoded = codec.encode(data).execute().finish();
    const decodedBaseClass = codec.decode(encoded).to(TestMessage);
    const decodedSubClass = codec.decode(encoded).to(TestExtendedMessage);

    expect(decodedBaseClass).toEqual(expectedBaseClassData);
    expect(decodedSubClass).toEqual(data);
    expect(decodedSubClass instanceof TestExtendedMessage).toBeTruthy();
  });
});

describe("Codec", () => {
  class CorrectMessage extends protobuf.Message {
    type: string;
    someField: string;
  }

  class CorrectMessage2 extends protobuf.Message {
    type: string;
    someField: string;
  }

  class CorrectMessage3 extends protobuf.Message {
    type: string;
    someField: string;
  }

  class IncorrectMessage extends protobuf.Message {}

  const buffer = Buffer.from([
    0x62, 0x75, 0x66, 0x66, 0x65, 0x72, 0x62, 0x75, 0x66, 0x66, 0x65, 0x72,
    0x66, 0x66, 0x65, 0x72,
  ]);
  const codec = ProtobufCodec.fromPath("./test/good", {
    predictiveOptions: {
      iv: buffer,
    },
  });

  const schemaEnvironment: SchemaEnvironment = {
    file: null,
    dynamicTypes: new Map(),
    write: () => {},
  };

  schemaEnvironment.dynamicTypes.set("CorrectMessage", {
    ctor: CorrectMessage,
    name: "CorrectMessage",
    parent: "",
    propertyMap: {},
  });

  it("should encode and decode a class correctly given protobuf schema", () => {
    const expected = { type: "CorrectMessage", someField: "hello" };
    const expected2 = { type: "CorrectMessage2", someField: "hello" };
    const expected3 = { type: "CorrectMessage3", someField: "hello" };

    const encoded = codec.encode(expected).execute().finish();
    const encoded2 = codec.encode(expected2).execute().finish();
    const encoded3 = codec.encode(expected3).execute().finish();

    const decoded = codec.decode(encoded).to(CorrectMessage);
    const decoded2 = codec.decode(encoded2).to(CorrectMessage2);
    const decoded3 = codec.decode(encoded3).to(CorrectMessage3);

    expect(decoded).toEqual(expected);
    expect(decoded2).toEqual(expected2);
    expect(decoded3).toEqual(expected3);
  });

  it("should encode and decode a class correctly with predictive decode", () => {
    const expected = { type: "CorrectMessage", someField: "hello" };
    const encoded = codec.encode(expected).predictive().finish();
    const decoded = codec.decode(encoded).predictive(schemaEnvironment);
    expect(decoded).toEqual(expected);
  });

  it("should throw error if the encoding and decoding are not compatible", () => {
    const expected = { type: "CorrectMessage", someField: "hello" };
    const encoded = codec.encode(expected).execute().finish();
    const decoded = () => codec.decode(encoded).predictive(schemaEnvironment);
    expect(decoded).toThrow();
  });

  it("should resolve the encrypted type if encoding is predictive but decoding is not", () => {
    const expected = { type: "CorrectMessage", someField: "hello" };
    const encoded = codec.encode(expected).predictive().finish();
    const decoded = codec.decode(encoded).to(CorrectMessage);

    expect(decoded["type"]).toEqual(expected["type"]);
  });

  it("should encode and decode a class correctly given in-memory protobuf schema", () => {
    const codec = ProtobufCodec.fromString(`syntax="proto3";
            message CorrectMessage {
              string type = 1;
              string some_field = 2;
            }
            message CorrectMessage2 {
              string type = 1;
              string some_field = 2;
            }
            `);

    const expected = { type: "CorrectMessage", someField: "hello" };
    const expected2 = { type: "CorrectMessage2", someField: "hello" };

    const encoded = codec.encode(expected).execute().finish();
    const encoded2 = codec.encode(expected2).execute().finish();

    const decoded = codec.decode(encoded).to(CorrectMessage);
    const decoded2 = codec.decode(encoded2).to(CorrectMessage2);

    expect(decoded).toEqual(expected);
    expect(decoded2).toEqual(expected2);
  });

  it("should throw an error in case of syntax error", () => {
    const codec = () =>
      ProtobufCodec.fromString(`
            message CorrectMessage {
              string type = 1;
              string some_field = 2;
            }
            `);

    expect(codec).toThrow("Syntax error: Error: illegal token 'string'");
  });

  it("should throw error if schema is not found", () => {
    const expected = { type: "CorrectMessage", someField: "hello" };
    const encoded = codec.encode(expected).execute().finish();
    const decoded = () => codec.decode(encoded).to(IncorrectMessage);

    expect(decoded).toThrow(
      "Decoding error: Error: Type IncorrectMessage not found. Make sure the schema was compiled successfully and that the type exists."
    );
  });

  it("should throw error in case of syntax error", () => {
    expect(() => ProtobufCodec.fromPath("./test/bad")).toThrow(
      "Syntax error: Error: illegal token 'string'"
    );
  });

  it("should throw error if the input buffer is not in correct format", () => {
    const badBuffer = Buffer.from("badbuffer");
    const decoded = () => codec.decode(badBuffer).to(CorrectMessage);

    expect(decoded).toThrow(
      "Decoding error: Error: Invalid input format. Make sure the buffer is compatible with protobuf standards."
    );
  });

  it("should throw error if type is missing from schema", () => {
    const object = { someField: "hello" };
    const encode = () => codec.encode(object).execute();

    expect(encode).toThrow(
      "Encoding error: Error: Type of the message is missing. Make sure that every message contains a type property."
    );
  });

  it("should throw error if no proto files have found", () => {
    expect(() => ProtobufCodec.fromPath(".")).toThrow(
      "Couldn't find protobuf files in the specified paths: " +
        path.resolve(".")
    );
  });
});
