import path from "path";
import fs from "fs";
import { MAX_TYPE_SIZE_B } from "./codec";

class SchemaDefinition {
  constructor() {}
}

enum PropertyType {
  double = "double",
  float = "float",
  int32 = "int32",
  int64 = "int64",
  uint32 = "uint32",
  sint32 = "sint32",
  fixed32 = "fixed32",
  sfixed32 = "sfixed32",
  bool = "bool",
  string = "string",
  bytes = "bytes",
  Any = "Any",
  Api = "google.protobuf.Api",
  BoolValue = "google.protobuf.BoolValue",
  BytesValue = "google.protobuf.BytesValue",
  DoubleValue = "google.protobuf.DoubleValue",
  Duration = "google.protobuf.Duration",
  Empty = "google.protobuf.Empty",
  Enum = "google.protobuf.Enum",
  EnumValue = "google.protobuf.EnumValue",
  Field = "google.protobuf.Field",
  Cardinality = "google.protobuf.Cardinality",
  Kind = "google.protobuf.Kind",
  FieldMask = "google.protobuf.FieldMask",
  FloatValue = "google.protobuf.FloatValue",
  Int32Value = "google.protobuf.Int32Value",
  Int64Value = "google.protobuf.Int64Value",
  ListValue = "google.protobuf.ListValue",
  Method = "google.protobuf.Method",
  Mixin = "google.protobuf.Mixin",
  NullValue = "google.protobuf.NullValue",
  Option = "google.protobuf.Option",
  SourceContext = "google.protobuf.SourceContext",
  StringValue = "google.protobuf.StringValue",
  Struct = "google.protobuf.Struct",
  Syntax = "google.protobuf.Syntax",
  Timestamp = "google.protobuf.Timestamp",
  Type = "google.protobuf.Type",
  UInt32Value = "google.protobuf.UInt32Value",
  UInt64Value = "google.protobuf.UInt64Value",
  Value = "google.protobuf.Value",
}

const ImportMapping = {
  [`${PropertyType.Timestamp}`]: "google/protobuf/timestamp.proto",
  [`${PropertyType.Duration}`]: "google/protobuf/duration.proto",
  [`${PropertyType.Any}`]: "google/protobuf/any.proto",
  [`${PropertyType.Api}`]: "google/protobuf/api.proto",
  [`${PropertyType.BoolValue}`]: "google/protobuf/wrappers.proto",
  [`${PropertyType.BytesValue}`]: "google/protobuf/wrappers.proto",
  [`${PropertyType.DoubleValue}`]: "google/protobuf/wrappers.proto",
  [`${PropertyType.Empty}`]: "google/protobuf/empty.proto",
  [`${PropertyType.Enum}`]: "google/protobuf/descriptor.proto",
  [`${PropertyType.EnumValue}`]: "google/protobuf/descriptor.proto",
  [`${PropertyType.Field}`]: "google/protobuf/descriptor.proto",
  [`${PropertyType.Cardinality}`]: "google/protobuf/descriptor.proto",
  [`${PropertyType.Kind}`]: "google/protobuf/descriptor.proto",
  [`${PropertyType.FieldMask}`]: "google/protobuf/field_mask.proto",
  [`${PropertyType.FloatValue}`]: "google/protobuf/wrappers.proto",
  [`${PropertyType.Int32Value}`]: "google/protobuf/wrappers.proto",
  [`${PropertyType.Int64Value}`]: "google/protobuf/wrappers.proto",
  [`${PropertyType.ListValue}`]: "google/protobuf/struct.proto",
  [`${PropertyType.Method}`]: "google/protobuf/descriptor.proto",
  [`${PropertyType.Mixin}`]: "google/protobuf/descriptor.proto",
  [`${PropertyType.NullValue}`]: "google/protobuf/struct.proto",
  [`${PropertyType.Option}`]: "google/protobuf/descriptor.proto",
  [`${PropertyType.SourceContext}`]: "google/protobuf/source_context.proto",
  [`${PropertyType.StringValue}`]: "google/protobuf/wrappers.proto",
  [`${PropertyType.Struct}`]: "google/protobuf/struct.proto",
  [`${PropertyType.Syntax}`]: "google/protobuf/descriptor.proto",
  [`${PropertyType.Type}`]: "google/protobuf/type.proto",
  [`${PropertyType.UInt32Value}`]: "google/protobuf/wrappers.proto",
  [`${PropertyType.UInt64Value}`]: "google/protobuf/wrappers.proto",
  [`${PropertyType.Value}`]: "google/protobuf/struct.proto",
};

interface SchemaTypeDescription {
  type: PropertyType | (new () => SchemaDefinition);
  repeated?: boolean;
}

class FileWriter {
  static write(outDir, fileName, content: string) {
    const fullPath = path.join(outDir, fileName);
    const dirName = path.dirname(fullPath);

    try {
      // Create directory recursively if it doesn't exist
      fs.mkdirSync(dirName, { recursive: true });

      // Write content to file
      fs.writeFileSync(fullPath, content);
    } catch (err) {
      throw new Error("Error writing file: " + err);
    }
  }
}

class SchemaEnvironment {
  readonly file: ProtobufFile;
  readonly dynamicTypes: Map<string, [any, string]>;

  constructor(file: ProtobufFile, dynamicTypes: Map<string, any>) {
    this.file = file;
    this.dynamicTypes = dynamicTypes;
  }

  /**
   *
   * @param outdir the directory to write into
   * @param filename the filename without extension
   */
  write(outdir, filename) {
    this.file.write(outdir, filename + ".proto");
    let classContent = 'const { ProtosparkMessage } = require("protospark");\n';

    for (const [key, dynamicType] of this.dynamicTypes) {
      classContent += this.dynamicTypes.get(key)[1] + "\n";
    }

    classContent +=
      "\nmodule.exports = {" +
      Array.from(this.dynamicTypes.keys()).join(",") +
      "}";
    FileWriter.write(outdir, filename + ".js", classContent);
  }
}

class ProtobufFile {
  readonly content: string;

  constructor(content: string) {
    this.content = content;
  }

  write(outDir, fileName) {
    FileWriter.write(outDir, fileName, this.content);
  }
}

class SchemaGenerator {
  static generate(schemas: Schema<any>[]): SchemaEnvironment {
    const schemaMap = {};

    for (const schema of schemas) {
      schemaMap[schema.SchemaType.name] = schema;
    }

    let file = 'syntax="proto3";\n\n';
    let imports = "";

    let body = "";

    const dynamicTypes: Map<string, any> = new Map();

    for (const schema of schemas) {
      const schemaInstance = new schema.SchemaType();
      SchemaGenerator._validateSchema(schema);
      const messageName =
        schema.SchemaType.name.replace("SchemaDefinition", "") + "Message";

      if (messageName.length > MAX_TYPE_SIZE_B) {
        throw new Error(
          `The message name ${messageName} exceeds the maximum allowed byte size: ${MAX_TYPE_SIZE_B}. Please use smaller schema definition names.`
        );
      }

      body += `message ${messageName} {\n`;
      const propertyMap: { [k: string]: SchemaTypeDescription } = {
        type: { type: PropertyType.string },
      };
      imports += SchemaGenerator._addProperties(
        schemaInstance,
        propertyMap
      ).join("\n");

      let index = 1;
      for (const [propertyName, description] of Object.entries(propertyMap)) {
        body += ` ${SchemaGenerator._getPrefix(description)} ${
          description.type
        } ${this.camelToSnake(propertyName)} = ${index++};\n`;
      }

      dynamicTypes.set(
        messageName,
        this._defineClass(schema, messageName, propertyMap)
      );
      body += `}\n\n`;
    }

    file += imports + "\n";
    file += body;

    return new SchemaEnvironment(new ProtobufFile(file), dynamicTypes);
  }

  private static _defineClass(schema, messageName, propertyMap) {
    const parents = schema.parents();
    const firstSuper = parents.length > 0 ? parents[0] : null;
    const properties = Object.entries(propertyMap)
      .map((entry) => `${entry[0]};`)
      .join("\n\t");

    let parentExtend = "ProtosparkMessage";

    if (firstSuper && firstSuper.constructor.name != SchemaDefinition.name) {
      parentExtend =
        firstSuper.constructor.name.replace("SchemaDefinition", "") + "Message";
    }

    const clazz = `class ${messageName} ${
      "extends " + parentExtend
    } {\n\t${properties}\n}`;

    return [new Function(clazz), clazz];
  }

  private static _addProperties(schemaInstance, propertyMap): string[] {
    const imports = [];
    const propertyNames = Object.getOwnPropertyNames(schemaInstance);

    for (const propertyName of propertyNames) {
      const description = schemaInstance[propertyName];

      if (propertyMap[propertyName]) {
        throw new Error(`Illegal redefinition of property: ${propertyName}.`);
      }

      if (ImportMapping[description["type"]]) {
        imports.push("import " + ImportMapping[description["type"]] + ";\n");
      }
      propertyMap[propertyName] = description;
    }

    return imports;
  }

  private static camelToSnake(camelCase) {
    return camelCase.replace(/[A-Z]/g, (match) => "_" + match.toLowerCase());
  }

  private static _validateSchema(schema: Schema<any>) {
    const schemaInstance = new schema.SchemaType();
    const propertyNames = Object.getOwnPropertyNames(new schema.SchemaType());
    if (!schema || !propertyNames || propertyNames.length === 0) {
      throw new Error("Empty schema is not allowed.");
    }

    for (const propertyName of propertyNames) {
      if (
        !propertyName ||
        !schemaInstance[propertyName] ||
        !schemaInstance[propertyName]["type"]
      ) {
        throw new Error(
          "Invalid schema, couldn't read property names or description"
        );
      }

      if (!("type" in schemaInstance[propertyName])) {
        throw new Error(
          `The property ${propertyName} has illegal value, must be SchemaTypeDescription`
        );
      }

      const isSchemaType =
        Object.values(PropertyType).indexOf(
          schemaInstance[propertyName]["type"]
        ) !== -1;

      if (
        !isSchemaType &&
        !(schemaInstance[propertyName]["type"] instanceof SchemaDefinition)
      ) {
        throw new Error(
          `Illegal type defined for property ${propertyName}, must be either PropertyType or SchemaDefinition`
        );
      }
    }
  }

  private static _getPrefix(desc: SchemaTypeDescription) {
    let prefix = "";

    if (desc.repeated) {
      prefix += "repeated";
    }

    return prefix;
  }
}

class Schema<T extends SchemaDefinition> {
  readonly SchemaType: new () => T;
  readonly ctor: SchemaDefinition;

  private constructor(SchemaType: new () => T) {
    this.SchemaType = SchemaType;
    this.ctor = Object.getPrototypeOf(Object.getPrototypeOf(new SchemaType()));
  }

  parents() {
    const parents = [
      Object.getPrototypeOf(Object.getPrototypeOf(new this.SchemaType())),
    ];
    let parent = parents[0];

    while (parent) {
      let upperParent = Object.getPrototypeOf(parent);

      if (upperParent) {
        parents.push(upperParent);
      }

      parent = upperParent;
    }

    return parents;
  }

  static define<T extends SchemaDefinition>(SchemaType: new () => T) {
    return new Schema(SchemaType);
  }

  static defineMultiple(
    SchemaTypes: Array<new () => SchemaDefinition>
  ): Array<Schema<any>> {
    const defined = [];

    for (const Type of SchemaTypes) {
      defined.push(this.define(Type));
    }

    return defined;
  }
}

export {
  ProtobufFile,
  PropertyType,
  Schema,
  SchemaGenerator,
  SchemaDefinition,
  SchemaTypeDescription,
  SchemaEnvironment,
};
