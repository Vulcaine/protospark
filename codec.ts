import fs from "fs";
import path from "path";
import protobuf from "protobufjs";
import crypto from "crypto";
import { ProtobufFile, SchemaEnvironment } from "./schema";

const MAX_TYPE_SIZE_B = 32;
const DEFAULT_ALGO = "aes-256-cbc";
const DEFALT_KEY = "protospark-public-secret32-bytes";
const DEFAULT_IV = crypto.randomBytes(16);

type ProtosparkMessage<T extends object = object> = protobuf.Message<T>;

interface CodecOptions {
  predictiveOptions?: PredictiveDecodeOptions;
}

interface PredictiveDecodeOptions {
  algo?: string;
  key?: string;
  iv?: Buffer;
}

interface EncodeOptions {
  verify?: boolean;
}

class Decoder {
  private buffer: Uint8Array;
  private schemaReader: SchemaReader;
  private options: CodecOptions;
  private key;

  constructor(
    schemaReader: SchemaReader,
    options: CodecOptions,
    buffer: Uint8Array
  ) {
    this.buffer = buffer;
    this.schemaReader = schemaReader;
    this.options = options;
    this.key = Buffer.from(this.options.predictiveOptions.key, "utf8");
  }

  to<T extends ProtosparkMessage>(DecodedType: new () => T): T {
    return this._decode(DecodedType, this.buffer);
  }

  predictive<T extends ProtosparkMessage>(
    schemaEnvironment: SchemaEnvironment
  ): T {
    return this._predictiveDecode(this.buffer, schemaEnvironment);
  }

  private _predictiveDecode<T extends ProtosparkMessage>(
    buffer: Uint8Array,
    schemaEnvironment: SchemaEnvironment
  ): T {
    const type = this._readTypeHeader(buffer);
    const dynamicType = schemaEnvironment.dynamicTypes.get(type);

    if (!dynamicType) {
      throw new Error(
        `Type ${type} could not be inferred. The type context must contain this type. An option is to try using the non-predictive method with actual type supplied.`
      );
    }

    const decoded = this._decodeByType(type, buffer) as T;
    const dynamicTypeInstance = new dynamicType.ctor[type]();

    for (const [prop, value] of Object.entries(decoded)) {
      dynamicTypeInstance[prop] = value;
    }

    dynamicTypeInstance["type"] = type;
    return dynamicTypeInstance;
  }

  private _readTypeHeader(buffer) {
    const typeFieldSpecifierBytes = 2;
    const encryptedTypeHeader = buffer.slice(
      typeFieldSpecifierBytes,
      MAX_TYPE_SIZE_B + typeFieldSpecifierBytes
    );
    return this._decrypt(encryptedTypeHeader.toString("utf8"));
  }

  private _decrypt(input) {
    try {
      const decipher = crypto.createDecipheriv(
        this.options.predictiveOptions.algo,
        this.key,
        this.options.predictiveOptions.iv
      );

      let decrypted =
        decipher.update(input, "hex", "utf8") + decipher.final("utf8");
      return decrypted;
    } catch (e) {
      throw new Error(`Decrypting ${input} failed: ` + e);
    }
  }

  private _decode<T extends ProtosparkMessage>(
    DecodedType: new () => T,
    buffer: Uint8Array
  ): T {
    const decoded = this._decodeByType(DecodedType.name, buffer);
    const dynamicTypeInstance = new DecodedType();

    for (const [prop, value] of Object.entries(decoded)) {
      dynamicTypeInstance[prop] = value;
    }

    dynamicTypeInstance["type"] = DecodedType.name;

    return dynamicTypeInstance;
  }

  private _decodeByType<T extends ProtosparkMessage>(
    type: string,
    buffer: Uint8Array
  ): T {
    try {
      this.schemaReader.checkCompiled();
      const SchemaType = this.schemaReader.checkIfExists(type);
      try {
        const decoded = SchemaType.decode(buffer) as T;
        const updatedType = {
          ...decoded,
          type,
        };
        return updatedType;
      } catch (e) {
        throw new Error(
          "Invalid input format. Make sure the buffer is compatible with protobuf standards."
        );
      }
    } catch (e) {
      throw new Error("Decoding error: " + e);
    }
  }
}

class Encoder {
  private schema: protobuf.Message | { [k: string]: any };
  private schemaReader: SchemaReader;
  private options: CodecOptions;
  private encoderOptions: EncodeOptions;
  private writer: protobuf.Writer;
  private key;

  constructor(
    schemaReader: SchemaReader,
    options: CodecOptions,
    encoderOptions: EncodeOptions,
    schema: protobuf.Message | { [k: string]: any },
    writer: protobuf.Writer
  ) {
    this.schema = schema;
    this.schemaReader = schemaReader;
    this.options = options;
    this.encoderOptions = encoderOptions;
    this.key = Buffer.from(this.options.predictiveOptions.key, "utf8");
    this.writer = writer;
  }

  execute() {
    return this._encode(this.schema, this.writer, this.encoderOptions);
  }

  predictive() {
    return this._encode(this.schema, this.writer, this.encoderOptions, true);
  }

  private _encode<T extends protobuf.Message>(
    schema: T | { [k: string]: any },
    writer?: protobuf.Writer,
    options: EncodeOptions = {
      verify: true,
    },
    predictive = false
  ): protobuf.Writer {
    try {
      const messageType = this.schemaReader.validateType(schema);
      const SchemaType = this.schemaReader.checkIfExists(messageType);
      const verifyError = options.verify
        ? SchemaType.verify(schema)
        : undefined;

      if (verifyError) {
        throw new Error("Error with schema: " + verifyError);
      }

      this.schemaReader.checkCompiled();
      let schemaToEncode = predictive
        ? {
            ...schema,
            type: this._encrypt(schema["type"]),
          }
        : schema;
      return SchemaType.encode(schemaToEncode, writer);
    } catch (e) {
      throw new Error("Encoding error: " + e);
    }
  }

  private _encrypt(input: string) {
    if (input.length > MAX_TYPE_SIZE_B) {
      throw new Error(`Input size cannot exceed ${MAX_TYPE_SIZE_B} bytes.`);
    }

    const cipher = crypto.createCipheriv(
      this.options.predictiveOptions.algo,
      this.key,
      this.options.predictiveOptions.iv
    );
    const encrypted = cipher.update(input, "utf8", "hex") + cipher.final("hex");
    return encrypted;
  }
}

class SchemaReader {
  private compiled: boolean;
  private compiledSchema: protobuf.Root;

  private constructor() {}

  static fromPath(schemaPath: string) {
    const codec = new SchemaReader();
    codec._compilePath(schemaPath);
    return codec;
  }

  static fromPaths(schemaPaths: string[]) {
    const codec = new SchemaReader();
    codec._compilePath(schemaPaths);
    return codec;
  }

  static fromString(protoContent: string) {
    const codec = new SchemaReader();
    codec._compileContent(protoContent);
    return codec;
  }

  toObject<T>(
    DecodedType: new () => T,
    message: ProtosparkMessage,
    options?: protobuf.IConversionOptions
  ) {
    const messageType = DecodedType.name;
    const SchemaType = this.checkIfExists(messageType);
    return SchemaType.toObject(message, options);
  }

  fromObject<T>(
    DecodedType: new () => T,
    plainObject: { [k: string]: any }
  ): ProtosparkMessage {
    const messageType = DecodedType.name;
    const SchemaType = this.checkIfExists(messageType);
    return SchemaType.fromObject(plainObject);
  }

  verify<T>(schema: T) {
    const messageType = this.validateType(schema);
    const SchemaType = this.rawSchema().lookupType(messageType);
    return SchemaType.verify(schema);
  }

  checkCompiled() {
    if (!this.compiled) {
      throw new Error(`Schema ${this.constructor.name} has not been compiled.`);
    }
  }

  validateType<T>(schema: T) {
    const messageType = schema["type"];

    if (!messageType) {
      throw new Error(
        "Type of the message is missing. Make sure that every message contains a type property."
      );
    }

    if (messageType.length > MAX_TYPE_SIZE_B) {
      throw new Error(
        `The size of type property exceeds the maximum allowed ${MAX_TYPE_SIZE_B} bytes.`
      );
    }

    return messageType;
  }

  rawSchema() {
    return this.compiledSchema;
  }

  checkIfExists(messageType: string): protobuf.Type {
    try {
      const SchemaType = this.compiledSchema.lookupType(messageType);
      return SchemaType as protobuf.Type;
    } catch (e) {
      throw new Error(
        `Type ${messageType} not found. Make sure the schema was compiled successfully and that the type exists.`
      );
    }
  }

  private _compileContent(content: string) {
    try {
      this.compiledSchema = protobuf.parse(content).root;
      this.compiled = true;
    } catch (e) {
      throw new Error("Syntax error: " + e);
    }
  }

  private _compilePath(p: string | string[]) {
    const absPath = Array.isArray(path)
      ? (p as string[]).map((p) => path.resolve(p))
      : path.resolve(p as string);
    const allFiles = Array.isArray(absPath)
      ? absPath
      : this._listAllProtoFiles(absPath);

    if (!allFiles || allFiles.length === 0) {
      throw new Error(
        "Couldn't find protobuf files in the specified paths: " + absPath
      );
    }
    try {
      this.compiledSchema = protobuf.loadSync(allFiles);
      this.compiled = true;
    } catch (e) {
      throw new Error("Syntax error: " + e);
    }
  }

  private _listAllProtoFiles(directory: string): string[] {
    try {
      const files = fs.readdirSync(directory);
      const protoFiles = files.filter(
        (file) => path.extname(file) === ".proto"
      );
      const filePaths = protoFiles.map((file) => path.join(directory, file));
      return filePaths;
    } catch (err) {
      throw new Error(
        `Error occured while attempting reading proto files in dir: ${directory}, err: ${err}`
      );
    }
  }
}

class ProtobufCodec {
  private options: CodecOptions;
  private schemaReader: SchemaReader;

  private constructor(
    options: CodecOptions = {
      predictiveOptions: {
        algo: DEFAULT_ALGO,
        key: DEFALT_KEY,
        iv: DEFAULT_IV,
      },
    }
  ) {
    this.options = options;
    this.options.predictiveOptions = {
      algo: this.options.predictiveOptions.algo ?? DEFAULT_ALGO,
      key: this.options.predictiveOptions.key ?? DEFALT_KEY,
      iv: this.options.predictiveOptions.iv ?? DEFAULT_IV,
    } as PredictiveDecodeOptions;
  }

  static fromPath(schemaPath: string, options?: CodecOptions) {
    const codec = new ProtobufCodec(options);
    codec._compilePath(schemaPath);
    return codec;
  }

  static fromPaths(schemaPaths: string[], options?: CodecOptions) {
    const codec = new ProtobufCodec(options);
    codec._compilePath(schemaPaths);
    return codec;
  }

  static fromString(protoContent: string, options?: CodecOptions) {
    const codec = new ProtobufCodec(options);
    codec._compileContent(protoContent);
    return codec;
  }

  static fromProtoFile(protoFile: ProtobufFile, options?: CodecOptions) {
    return this.fromString(protoFile.content, options);
  }

  private _compileContent(protoContent: string) {
    this.schemaReader = SchemaReader.fromString(protoContent);
  }

  decode(buffer: Uint8Array): Decoder {
    return new Decoder(this.schemaReader, this.options, buffer);
  }

  encode<T extends protobuf.Message>(
    schema: T | { [k: string]: any },
    writer?: protobuf.Writer,
    options: EncodeOptions = {
      verify: true,
    }
  ): Encoder {
    return new Encoder(
      this.schemaReader,
      this.options,
      options,
      schema,
      writer
    );
  }

  rawSchema() {
    return this.schemaReader.rawSchema();
  }

  fromObject<T>(
    DecodedType: new () => T,
    plainObject: { [k: string]: any }
  ): ProtosparkMessage {
    return this.schemaReader.fromObject(DecodedType, plainObject);
  }

  toObject<T>(
    DecodedType: new () => T,
    message: ProtosparkMessage,
    options?: protobuf.IConversionOptions
  ) {
    return this.schemaReader.toObject(DecodedType, message, options);
  }

  verify<T>(schema: T) {
    return this.schemaReader.verify(schema);
  }

  private _compilePath(p: string | string[]) {
    this.schemaReader = Array.isArray(p)
      ? SchemaReader.fromPaths(p as string[])
      : SchemaReader.fromPath(p);
  }
}

export { ProtobufCodec, CodecOptions, MAX_TYPE_SIZE_B, ProtosparkMessage };
