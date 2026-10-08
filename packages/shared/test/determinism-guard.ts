import ts from "typescript";

const mathMembers = new Set([
  "abs",
  "floor",
  "ceil",
  "round",
  "trunc",
  "sign",
  "min",
  "max",
  "sqrt",
  "fround",
  "imul",
  "clz32",
  "E",
  "LN2",
  "LN10",
  "LOG2E",
  "LOG10E",
  "PI",
  "SQRT1_2",
  "SQRT2",
]);
const forbiddenNames = new Set([
  "Date",
  "performance",
  "crypto",
  "Intl",
  "globalThis",
  "window",
  "document",
  "navigator",
  "self",
  "global",
  "process",
  "Buffer",
  "Deno",
  "Bun",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "Worker",
  "require",
  "eval",
  "Function",
  "Reflect",
  "Proxy",
  "setTimeout",
  "setInterval",
  "queueMicrotask",
  "requestAnimationFrame",
  "console",
]);
const forbiddenMembers = new Set([
  "localeCompare",
  "random",
  "constructor",
  "__proto__",
  "getPrototypeOf",
  "setPrototypeOf",
  "getOwnPropertyDescriptor",
  "getOwnPropertyDescriptors",
]);

export interface GuardFinding {
  readonly line: number;
  readonly reason: string;
}
/**
 * Fail closed on global indirection and nonnumeric computed members. We do not
 * attempt to prove arbitrary JavaScript alias/data-flow safety: Math may only
 * appear as a direct allowlisted dot access. Thus destructuring, aliasing and
 * dynamic access cannot evade the member allowlist. Numeric typed-array indices
 * remain legal; type assertions cannot turn a string member into a numeric key.
 */
export function scanDeterminism(
  source: ts.SourceFile,
  checker: ts.TypeChecker,
): GuardFinding[] {
  const findings: GuardFinding[] = [];
  function add(node: ts.Node, reason: string): void {
    findings.push({
      line:
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      reason,
    });
  }
  function numericIndex(node: ts.Expression): boolean {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node))
      return false;
    if (ts.isParenthesizedExpression(node))
      return numericIndex(node.expression);
    if (ts.isBinaryExpression(node))
      return numericIndex(node.left) && numericIndex(node.right);
    if (ts.isPrefixUnaryExpression(node)) return numericIndex(node.operand);
    if (ts.isIdentifier(node)) {
      const declarations = checker.getSymbolAtLocation(node)?.declarations;
      for (const declaration of declarations ?? []) {
        if (ts.isVariableDeclaration(declaration) && declaration.initializer)
          return numericIndex(declaration.initializer);
      }
    }
    const type = checker.getTypeAtLocation(node);
    return (type.flags & ts.TypeFlags.NumberLike) !== 0;
  }
  function visit(node: ts.Node): void {
    if (
      node.kind === ts.SyntaxKind.AsteriskAsteriskToken ||
      node.kind === ts.SyntaxKind.AsteriskAsteriskEqualsToken
    )
      add(node, "Exponentiation is forbidden");
    if (ts.isIdentifier(node)) {
      if (forbiddenNames.has(node.text))
        add(node, `Forbidden API: ${node.text}`);
      if (node.text === "Math") {
        const parent = node.parent;
        if (
          !ts.isPropertyAccessExpression(parent) ||
          parent.expression !== node ||
          !mathMembers.has(parent.name.text)
        )
          add(node, "Math must be a direct allowlisted member access");
      }
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      (forbiddenMembers.has(node.name.text) ||
        node.name.text.startsWith("toLocale"))
    )
      add(node, `Forbidden member: ${node.name.text}`);
    if (
      ts.isElementAccessExpression(node) &&
      !numericIndex(node.argumentExpression)
    )
      add(node, "Computed member must be provably numeric without assertions");
    if (ts.isComputedPropertyName(node) && !numericIndex(node.expression)) {
      add(node, "Computed property names must be provably numeric");
    }
    if (
      ts.isBindingElement(node) ||
      ts.isPropertyAssignment(node) ||
      ts.isShorthandPropertyAssignment(node)
    ) {
      // Assignment destructuring is an object-literal AST; quoted keys are
      // StringLiteral nodes in both forms. Neither may hide a forbidden API.
      const name = ts.isBindingElement(node)
        ? (node.propertyName ?? node.name)
        : node.name;
      if (
        (ts.isIdentifier(name) || ts.isStringLiteral(name)) &&
        (forbiddenMembers.has(name.text) || name.text.startsWith("toLocale"))
      )
        add(node, `Forbidden destructured member: ${name.text}`);
    }
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const module = node.moduleSpecifier;
      if (
        module &&
        (!ts.isStringLiteral(module) || !module.text.startsWith("."))
      )
        add(node, "Shared code may only import relative shared modules");
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    )
      add(node, "Dynamic imports are forbidden in deterministic code");
    if (ts.isNumericLiteral(node) && !/^0[xob]/i.test(node.getText(source))) {
      const significand =
        node.getText(source).replaceAll("_", "").split(/[eE]/)[0] ?? "";
      const digits = significand.replace(".", "").replace(/^0+/, "");
      if (digits.length > 17)
        add(node, "Numeric constant exceeds 17 significant digits");
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}
