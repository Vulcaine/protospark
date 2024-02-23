import fs from "fs";
import path from "path";
import protobuf from "protobufjs";

interface IProtobufCodec {
  decode<T extends protobuf.Message<{}>>(
    DecodedType: new () => T,
    buffer: Buffer
  ): T;
  encode<T>(schema: T): protobuf.Writer;
}

interface CodecOptions {
  verifyByDefault: boolean;
}

class ProtobufCodec implements IProtobufCodec {
  private compiledSchema: protobuf.Root;
  private compiled: boolean;
  private options: CodecOptions;

  private constructor(options: CodecOptions = { verifyByDefault: true }) {
    this.options = options;
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

  rawSchema() {
    return this.compiledSchema;
  }

  fromObject<T>(
    DecodedType: new () => T,
    plainObject: { [k: string]: any }
  ): protobuf.Message<{}> {
    const messageType = DecodedType.name;
    const SchemaType = this._checkIfExists(messageType);
    return SchemaType.fromObject(plainObject);
  }

  toObject<T>(
    DecodedType: new () => T,
    message: protobuf.Message<{}>,
    options?: protobuf.IConversionOptions
  ) {
    const messageType = DecodedType.name;
    const SchemaType = this._checkIfExists(messageType);
    return SchemaType.toObject(message, options);
  }

  decode<T extends protobuf.Message<{}>>(
    DecodedType: new () => T,
    buffer: protobuf.Reader | Uint8Array
  ): T {
    try {
      const messageType = DecodedType.name;
      this._checkCompiled();
      const SchemaType = this._checkIfExists(messageType);
      try {
        return SchemaType.decode(buffer) as T;
      } catch (e) {
        throw new Error(
          "Invalid input format. Make sure the buffer is compatible with protobuf standards."
        );
      }
    } catch (e) {
      throw new Error("Decoding error: " + e);
    }
  }

  verify<T>(schema: T) {
    const messageType = this._validateType(schema);
    const SchemaType = this.compiledSchema.lookupType(messageType);
    return SchemaType.verify(schema);
  }

  private _validateType<T>(schema: T) {
    const messageType = schema["type"];

    if (!messageType) {
      throw new Error(
        "Type of the message is missing. Make sure that every message contains a type property."
      );
    }

    return messageType;
  }

  private _checkIfExists(messageType: string): protobuf.Type {
    try {
      const SchemaType = this.compiledSchema.lookupType(messageType);
      return SchemaType;
    } catch (e) {
      throw new Error(
        `Type ${messageType} not found. Make sure the schema was compiled successfully and that the type exists.`
      );
    }
  }

  encode<T extends protobuf.Message>(
    schema: T | { [k: string]: any },
    writer?: protobuf.Writer,
    verify: boolean = this.options.verifyByDefault
  ): protobuf.Writer {
    try {
      const messageType = this._validateType(schema);
      const SchemaType = this._checkIfExists(messageType);
      const verifyError = verify ? SchemaType.verify(schema) : undefined;

      if (verifyError) {
        throw new Error("Error with schema: " + verifyError);
      }

      this._checkCompiled();
      return SchemaType.encode(schema, writer);
    } catch (e) {
      throw new Error("Encoding error: " + e);
    }
  }

  private _checkCompiled() {
    if (!this.compiled) {
      throw new Error(`Schema ${this.constructor.name} has not been compiled.`);
    }
  }
}

export { ProtobufCodec, CodecOptions };
