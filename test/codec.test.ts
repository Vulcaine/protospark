import protobuf from "protobufjs";
import { ProtobufCodec } from "../codec";
import path from "path";

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

const codec = ProtobufCodec.fromPath("./test/good");

describe("Codec", () => {
  it("should encode and decode a class correctly given protobuf schema", () => {
    const expected = { type: "CorrectMessage", someField: "hello" };
    const encoded = codec.encode(expected).finish();
    const decoded = codec.decode(CorrectMessage, encoded);
    const decoded2 = codec.decode(CorrectMessage2, encoded);
    const decoded3 = codec.decode(CorrectMessage3, encoded);

    expect(decoded).toEqual(expected);
    expect(decoded2).toEqual(expected);
    expect(decoded3).toEqual(expected);
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
    const encoded = codec.encode(expected).finish();
    const decoded = codec.decode(CorrectMessage, encoded);
    const decoded2 = codec.decode(CorrectMessage2, encoded);

    expect(decoded).toEqual(expected);
    expect(decoded2).toEqual(expected);
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
    const encoded = codec.encode(expected).finish();
    const decoded = () => codec.decode(IncorrectMessage, encoded);

    expect(decoded).toThrow(
      "Decoding error: Error: Type IncorrectMessage not found. Make sure the schema was compiled successfully and that the type exists."
    );
  });

  it("should throw error if in case of syntax error", () => {
    expect(() => ProtobufCodec.fromPath("./test/bad")).toThrow(
      "Syntax error: Error: illegal token 'string'"
    );
  });

  it("should throw error if the input buffer is not in correct format", () => {
    const badBuffer = Buffer.from("badbuffer");
    const decoded = () => codec.decode(CorrectMessage, badBuffer);

    expect(decoded).toThrow(
      "Decoding error: Error: Invalid input format. Make sure the buffer is compatible with protobuf standards."
    );
  });

  it("should throw error if type is missing from schema", () => {
    const object = { someField: "hello" };
    const encode = () => codec.encode(object);

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
