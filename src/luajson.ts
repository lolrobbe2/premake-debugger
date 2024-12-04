import { fromPairs, isArray, isBoolean, isEmpty, isNull, isNumber, isObject, isString, keys, map, repeat } from 'lodash';
import { Expression, Node, parse as parseLua } from 'luaparse';

const formatLuaString = (string: string, singleQuote: boolean): string =>
  singleQuote ? `'${string.replace(/'/g, "\\'")}'` : `"${string.replace(/"/g, '\\"')}"`;

const valueKeys: Record<string, string> = { false: 'false', true: 'true', null: 'nil' };

const formatLuaKey = (string: string, singleQuote: boolean): string =>
  valueKeys[string]
    ? `[${valueKeys[string]}]`
    : string.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/)
    ? string
    : `[${formatLuaString(string, singleQuote)}]`;

interface FormatOptions {
  eol?: string;
  singleQuote?: boolean;
  spaces?: number | string | null;
}

const format = (
  value: unknown,
  options: FormatOptions = { eol: '\n', singleQuote: true, spaces: 2 }
): string => {
  const eol = isString(options.eol) ? options.eol : '\n';
  const singleQuote = isBoolean(options.singleQuote) ? options.singleQuote : true;
  const spaces = isNull(options.spaces) || isNumber(options.spaces) || isString(options.spaces) ? options.spaces : 2;

  const rec = (value: unknown, i: number = 0): string => {
    if (isNull(value)) {
      return 'nil';
    }
    if (isBoolean(value) || isNumber(value)) {
      return value.toString();
    }
    if (isString(value)) {
      return formatLuaString(value, singleQuote);
    }
    if (isArray(value)) {
      if (isEmpty(value)) {
        return '{}';
      }
      if (spaces) {
        const indent = isNumber(spaces) ? repeat(' ', spaces * (i + 1)) : repeat(spaces, i + 1);
        const outdent = isNumber(spaces) ? repeat(' ', spaces * i) : repeat(spaces, i);
        return `{${eol}${value.map(e => `${indent}${rec(e, i + 1)},`).join(eol)}${eol}${outdent}}`;
      }
      return `{${value.map(e => `${rec(e, i + 1)},`).join('')}}`;
    }
    if (isObject(value)) {
      if (isEmpty(value)) {
        return '{}';
      }
      if (spaces) {
        const indent = isNumber(spaces) ? repeat(' ', spaces * (i + 1)) : repeat(spaces, i + 1);
        const outdent = isNumber(spaces) ? repeat(' ', spaces * i) : repeat(spaces, i);
        return `{${eol}${keys(value)
          .map(key => `${indent}${formatLuaKey(key, singleQuote)} = ${rec((value as Record<string, unknown>)[key], i + 1)},`)
          .join(eol)}${eol}${outdent}}`;
      }
      return `{${keys(value)
        .map(key => `${formatLuaKey(key, singleQuote)}=${rec((value as Record<string, unknown>)[key], i + 1)},`)
        .join('')}}`;
    }
    throw new Error(`can't format ${typeof value}`);
  };

  return `return${spaces ? ' ' : ''}${rec(value)}`;
};

const luaAstToJson = (ast: Node | Expression): unknown => {
  if (['NilLiteral', 'BooleanLiteral', 'NumericLiteral'].includes(ast.type)) {
    return (ast as any).value;
  }
  if(ast.type === 'StringLiteral'){
    return ast.raw.replaceAll('\"','');
  }
  if (ast.type === 'UnaryExpression' && ast.operator === '-') {
    return -(luaAstToJson(ast.argument) as number);
  }
  if (ast.type === 'Identifier') {
    return ast.name;
  }
  if (['TableKey', 'TableKeyString'].includes(ast.type)) {
    // Ensure the node has a key and value
    if ('key' in ast && 'value' in ast) {
      return {
        __internal_table_key: true,
        key: luaAstToJson(ast.key),
        value: luaAstToJson(ast.value),
      };
    }
    throw new Error(`TableKey or TableKeyString node missing key or value: ${JSON.stringify(ast)}`);
  }
  if (ast.type === 'TableValue') {
    return luaAstToJson(ast.value);
  }
  if (ast.type === 'TableConstructorExpression') {
    if (ast.fields[0] && 'key' in ast.fields[0]) {
      const object = fromPairs(
        map(ast.fields, field => {
          const parsedField = luaAstToJson(field) as { key: string; value: unknown };
          return [parsedField.key, parsedField.value];
        })
      );
      return isEmpty(object) ? [] : object;
    }
    return map(ast.fields, field => {
      const value = luaAstToJson(field);
      if(value === null) {return undefined;}
      return (value as any).__internal_table_key ? [(value as any).key, (value as any).value] : value;
    });
  }
  if (ast.type === 'LocalStatement') {
    const values = (ast.init || []).map(luaAstToJson);
    return values.length === 1 ? values[0] : values;
  }
  if (ast.type === 'ReturnStatement') {
    const values = ast.arguments.map(luaAstToJson);
    return values.length === 1 ? values[0] : values;
  }
  if (ast.type === 'Chunk') {
    return luaAstToJson(ast.body[0]);
  }
  if (ast.type === 'FunctionDeclaration') {
    console.log('FunctionDeclaration found');
    // Handle function declaration parsing here if needed
    return "function";
  }
  throw new Error(`Unhandled AST node type: ${ast.type}`);
};


const parse = (value: string): unknown => luaAstToJson(parseLua(value, { comments: false }));

export { format, parse };
