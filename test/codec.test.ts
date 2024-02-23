import protobuf from "protobufjs";
import { ProtobufCodec } from "../codec";
import path from "path";
import crypto from "crypto";

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
  0x62, 0x75, 0x66, 0x66, 0x65, 0x72, 0x62, 0x75, 0x66, 0x66, 0x65, 0x72, 0x66,
  0x66, 0x65, 0x72,
]);
const codec = ProtobufCodec.fromPath("./test/good", {
  predictiveOptions: {
    iv: buffer,
  },
});

describe("Codec", () => {
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
    const decoded = codec.decode(encoded).predictive();
    expect(decoded).toEqual(expected);
  });

  it("should throw error if the encoding and decoding are not compatible", () => {
    const expected = { type: "CorrectMessage", someField: "hello" };
    const encoded = codec.encode(expected).execute().finish();
    const decoded = () => codec.decode(encoded).predictive();
    expect(decoded).toThrow();
  });

  it("should contain the encrypted type if encoding is predictive but decoding is not", () => {
    const expected = { type: "CorrectMessage", someField: "hello" };
    const encoded = codec.encode(expected).predictive().finish();
    const decoded = codec.decode(encoded).to(CorrectMessage);
    // the encoded type will be in a hex format, this is not good, however not considered an error for the decoder
    expect(decoded["type"]).not.toEqual(expected["type"]);
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
