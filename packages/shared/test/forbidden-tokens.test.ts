import { readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { scanDeterminism } from "./determinism-guard.js";

const root = fileURLToPath(new URL("../src/", import.meta.url));
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourceFiles(join(directory, entry.name))
      : entry.name.endsWith(".ts")
        ? [join(directory, entry.name)]
        : [],
  );
}
const options: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  strict: true,
  types: [],
  lib: ["lib.es2022.d.ts"],
};

describe("deterministic shared source boundary", () => {
  it("checks every shared source AST and rejects imports escaping shared", () => {
    const files = sourceFiles(root);
    expect(files.length).toBeGreaterThan(10);
    const program = ts.createProgram(files, options);
    const checker = program.getTypeChecker();
    const findings: string[] = [];
    for (const file of files) {
      const source = program.getSourceFile(file);
      if (!source) throw new Error(`Missing source ${file}`);
      for (const found of scanDeterminism(source, checker))
        findings.push(`${relative(root, file)}:${found.line}: ${found.reason}`);
      for (const statement of source.statements) {
        if (
          !ts.isImportDeclaration(statement) &&
          !ts.isExportDeclaration(statement)
        )
          continue;
        const specifier = statement.moduleSpecifier;
        if (
          specifier &&
          ts.isStringLiteral(specifier) &&
          specifier.text.startsWith(".")
        ) {
          const target = relative(root, resolve(dirname(file), specifier.text));
          if (target.startsWith(".."))
            findings.push(
              `Import escapes shared: ${file} -> ${specifier.text}`,
            );
        }
      }
    }
    expect(findings).toEqual([]);
  });

  const hostile = [
    "Math.random()",
    "Math.sin(1)",
    "Math.pow(2,3)",
    "Math.hypot(1,2)",
    "let x=2; x **= 3",
    "2 ** 3",
    "const m = Math; m.random()",
    "const { random: rng } = Math; rng()",
    "Math['random']()",
    "Math['ra'+'ndom']()",
    "const k='random'; Math[k]()",
    "const f = Math.random; f()",
    "(Math).sin(1)",
    "globalThis.Math.random()",
    "Reflect.get(Math,'random')()",
    "const { Math: m } = globalThis; m.sin(1)",
    "new Date()",
    "const d = Date; new d()",
    "performance.now()",
    "crypto.getRandomValues(new Uint8Array(1))",
    "new Intl.NumberFormat()",
    "'a'.localeCompare('b')",
    "(3).toLocaleString()",
    "const k='toLocaleString'; (3)[k]()",
    "'a'['locale'+'Compare']('b')",
    "const {toLocaleString: f}=3; f()",
    "const {['to'+'LocaleString']: f}=3; f()",
    "const { 'constructor': make } = Math.abs; make('return Math.random()')()",
    "const { 'localeCompare': compare } = 'x'; compare.call('a','b')",
    "const { 'toLocaleString': format } = 1; format()",
    "let format=()=>''; ({toLocaleString:format}=1); format()",
    "let make; ({'constructor':make}=Math.abs); make('return Math.random()')()",
    "let toLocaleString; ({toLocaleString}=1); toLocaleString()",
    "const get=Object.getOwnPropertyDescriptor; const proto=get(Object,'getPrototypeOf').value(Math.abs); get(proto,'constructor').value('return Math.random()')()",
    "const key='constructor' as unknown as number; Math.abs[key]('return Date')()",
    "[].constructor.constructor('return Date')()",
    "Object.getPrototypeOf([])",
    "import fs from 'node:fs'",
    "import('node:fs')",
    "require('fs')",
    "fetch('/')",
    "window.document",
    "process.hrtime()",
    "new Function('return 1')()",
    "1.234567890123456789",
    "const k='random' as unknown as number; Math[k]()",
  ];
  const safe = [
    "/** Math.random() and a ** 2 are forbidden examples. */ export const x=Math.sqrt(4);",
    "export const s='Date performance crypto Math.sin ** toLocaleString';",
    "const values=new Float64Array(3); for(let i=0;i<3;i++) values[i]=Math.imul(i,3);",
    "const n=2; const a=[1,2,3]; const x=a[n-1]; const y=Math.PI;",
    "const {'length': size}=[1,2]; let count=0; ({length:count}=[3]);",
  ];
  const fixtures = [...hostile, ...safe];
  const fixturePaths = fixtures.map((_, i) =>
    resolve(root, `fixture-${i}.ts`).replaceAll("\\", "/"),
  );
  const sources = new Map(
    fixturePaths.map((path, i) => [path, `${fixtures[i]}\nexport {};`]),
  );
  const host = ts.createCompilerHost(options);
  const defaultRead = host.readFile;
  const defaultSource = host.getSourceFile;
  const defaultExists = host.fileExists;
  host.fileExists = (name): boolean =>
    sources.has(name.replaceAll("\\", "/")) || defaultExists(name);
  host.readFile = (name): string | undefined =>
    sources.get(name.replaceAll("\\", "/")) ?? defaultRead(name);
  host.getSourceFile = (name, languageVersion): ts.SourceFile | undefined => {
    const text = sources.get(name.replaceAll("\\", "/"));
    return text === undefined
      ? defaultSource(name, languageVersion)
      : ts.createSourceFile(name, text, languageVersion, true);
  };
  const program = ts.createProgram(fixturePaths, options, host);
  const checker = program.getTypeChecker();
  it.each(
    fixtures.map((text, i) => ({ text, i, shouldReject: i < hostile.length })),
  )("hostile/comment/string fixture $i: $text", ({ i, shouldReject }) => {
    const source = program.getSourceFile(fixturePaths[i] as string);
    if (!source) throw new Error("Fixture missing");
    expect(scanDeterminism(source, checker).length > 0).toBe(shouldReject);
  });
});
