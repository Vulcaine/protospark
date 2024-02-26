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

const ProtoToJavascriptProperty = (protoType: PropertyType) => {
  switch (protoType) {
    case PropertyType.double:
    case PropertyType.float:
    case PropertyType.int32:
    case PropertyType.int64:
    case PropertyType.uint32:
    case PropertyType.sint32:
    case PropertyType.fixed32:
    case PropertyType.sfixed32:
      return "number";
    case PropertyType.bool:
      return "boolean";
    case PropertyType.string:
      return "string";
    case PropertyType.bytes:
      return "Uint8Array";
    case PropertyType.Any:
    case PropertyType.Api:
    case PropertyType.Enum:
    case PropertyType.EnumValue:
    case PropertyType.Field:
    case PropertyType.Cardinality:
    case PropertyType.Kind:
    case PropertyType.FieldMask:
    case PropertyType.Method:
    case PropertyType.Mixin:
    case PropertyType.Option:
    case PropertyType.SourceContext:
    case PropertyType.Syntax:
    case PropertyType.Type:
    case PropertyType.Value:
      return "any"; // or specific object if available
    case PropertyType.BoolValue:
    case PropertyType.DoubleValue:
      return "number";
    case PropertyType.BytesValue:
      return "Uint8Array";
    case PropertyType.Duration:
      return "string"; // or a custom object
    case PropertyType.Empty:
      return "{}";
    case PropertyType.Int32Value:
    case PropertyType.Int64Value:
    case PropertyType.UInt32Value:
    case PropertyType.UInt64Value:
    case PropertyType.FloatValue:
    case PropertyType.StringValue:
    case PropertyType.Struct:
      return "any"; // or specific object if available
    case PropertyType.Timestamp:
      return "Date"; // or a custom Date object
    case PropertyType.ListValue:
      return "Array<any>"; // or specific object if available
    default:
      throw new Error(`Property ${protoType} is not supported.`);
  }
};

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

interface SchemaWriteOptions {
  format: string;
}

interface Clazz {
  ctor: any;
  name: string;
  parent: string;
  propertyMap: { [k: string]: SchemaTypeDescription };
}

class SchemaEnvironment {
  readonly file: ProtobufFile;
  readonly dynamicTypes: Map<string, Clazz>;

  constructor(file: ProtobufFile, dynamicTypes: Map<string, any>) {
    this.file = file;
    this.dynamicTypes = dynamicTypes;
  }

  /**
   *
   * @param outdir the directory to write into
   * @param filename the filename without extension
   */
  write(outdir, filename, options?: SchemaWriteOptions) {
    this.file.write(outdir, filename + ".proto");
    const isTS = options && options.format && options.format == "ts";

    let classContent = isTS
      ? 'import { ProtosparkMessage } from "protospark";\n'
      : 'const { ProtosparkMessage } = require("protospark");\n';

    const modifier = isTS ? "readonly" : "";

    for (const [key, dynamicType] of this.dynamicTypes) {
      const clazz: Clazz = dynamicType;
      let clazzStr = `class ${clazz.name} extends ${clazz.parent} {\n`;

      for (const [typeName, property] of Object.entries(clazz.propertyMap)) {
        const typeDesc = property as SchemaTypeDescription;

        const typeStr =
          typeDesc.type instanceof SchemaDefinition
            ? typeDesc.type.toString()
            : ProtoToJavascriptProperty(typeDesc.type as PropertyType);

        if (!typeStr) {
          throw new Error(`Type ${typeDesc.type} is not supported.`);
        }

        const type = isTS ? `:${typeStr}` : "";
        clazzStr += `${modifier} ${typeName}${type};\n`;
      }

      clazzStr += "}";
      classContent += clazzStr + "\n";
    }

    const exportKeyword = isTS ? "export " : "module.exports =";
    const extension = isTS ? "ts" : "js";

    classContent +=
      `\n${exportKeyword} {` +
      Array.from(this.dynamicTypes.keys()).join(",") +
      "}";
    FileWriter.write(outdir, filename + `.${extension}`, classContent);
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

    const dynamicTypes: Map<string, Clazz> = new Map();

    for (const schema of schemas) {
      const schemaInstance = new schema.SchemaType();
      SchemaGenerator._validateSchema(schema);
      const messageName = this._getMessageName(schema.SchemaType.name);

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
        const typeStr = this._instanceof(description.type, SchemaDefinition)
          ? this._getMessageName((description.type as any).name)
          : description.type;

        body += ` ${SchemaGenerator._getPrefix(
          description
        )} ${typeStr} ${this.camelToSnake(propertyName)} = ${index++};\n`;
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

  private static _getMessageName(schemaDefName: string) {
    return schemaDefName.replace("SchemaDefinition", "") + "Message";
  }

  private static _defineClass(schema, messageName, propertyMap) {
    const parents = schema.parents();
    const firstSuper = parents.length > 0 ? parents[0] : null;
    const properties = Object.entries(propertyMap)
      .map((entry) => `${entry[0]};`)
      .join("\n\t");

    let parentExtend = "ProtosparkMessage";

    if (firstSuper && firstSuper.constructor.name != SchemaDefinition.name) {
      parentExtend = this._getMessageName(firstSuper.constructor.name);
    }

    const clazz = `class ${messageName} ${
      "extends " + parentExtend
    } {\n\t${properties}\n}`;

    return {
      ctor: new Function(clazz),
      name: messageName,
      parent: parentExtend,
      propertyMap,
    } as Clazz;
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
        !this._instanceof(
          schemaInstance[propertyName]["type"],
          SchemaDefinition
        )
      ) {
        throw new Error(
          `Illegal type defined for property ${propertyName}, must be either PropertyType or SchemaDefinition`
        );
      }
    }
  }

  private static _instanceof(obj, what) {
    try {
      let prototype = Object.getPrototypeOf(obj.prototype);
      const whatPrototype = what.prototype;

      while (prototype) {
        if (prototype == whatPrototype) {
          return true;
        }

        prototype = Object.getPrototypeOf(prototype);
      }

      return false;
    } catch (e) {
      return false;
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
