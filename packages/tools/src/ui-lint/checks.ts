import postcss from "postcss";
import ts from "typescript";
import { currentId } from "../../../client/src/ui/t";
export interface Finding {
  file: string;
  line: number;
  rule: string;
  detail: string;
}
const sinks = new Set([
  "children",
  "title",
  "aria-label",
  "placeholder",
  "label",
]);
/** Resolve simple static aliases/expressions so a const is not a text-literal escape. */
export function scanTs(file: string, source: string): Finding[] {
  const ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const aliases = new Map<string, ts.Expression>();
  const findings: Finding[] = [];
  const walk = (node: ts.Node, fn: (node: ts.Node) => void): void => {
    fn(node);
    ts.forEachChild(node, (child) => walk(child, fn));
  };
  walk(ast, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    )
      aliases.set(node.name.text, node.initializer);
  });
  const literal = (node: ts.Node, seen = new Set<string>()): boolean => {
    if (ts.isStringLiteralLike(node)) return node.text.trim().length > 0;
    if (ts.isJsxExpression(node))
      return !!node.expression && literal(node.expression, seen);
    if (
      ts.isIdentifier(node) &&
      aliases.has(node.text) &&
      !seen.has(node.text)
    ) {
      seen.add(node.text);
      return literal(aliases.get(node.text)!, seen);
    }
    if (ts.isBinaryExpression(node)) {
      const operator = node.operatorToken.kind;
      if (operator === ts.SyntaxKind.AmpersandAmpersandToken)
        return literal(node.right, seen);
      if (
        operator !== ts.SyntaxKind.PlusToken &&
        operator !== ts.SyntaxKind.BarBarToken &&
        operator !== ts.SyntaxKind.QuestionQuestionToken
      )
        return false;
      return (
        literal(node.left, new Set(seen)) || literal(node.right, new Set(seen))
      );
    }
    if (ts.isConditionalExpression(node))
      return (
        literal(node.whenTrue, new Set(seen)) ||
        literal(node.whenFalse, new Set(seen))
      );
    if (
      ts.isArrayLiteralExpression(node) ||
      ts.isParenthesizedExpression(node) ||
      ts.isTemplateExpression(node)
    ) {
      let found = false;
      ts.forEachChild(node, (part) => {
        found ||= literal(part, new Set(seen));
      });
      return found;
    }
    return false;
  };
  const add = (node: ts.Node, rule: string, detail: string): void => {
    findings.push({
      file,
      line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      rule,
      detail,
    });
  };
  const trustedTextAdapter = /[/\\]components[/\\]Text\.tsx$/.test(file);
  const indexOnly = /[/\\]gallery[/\\]Gallery\.tsx$/.test(file);
  walk(ast, (node) => {
    if (
      ts.isJsxText(node) &&
      node.text.trim() &&
      !trustedTextAdapter &&
      !indexOnly
    )
      add(node, "literal-text", node.text.trim());
    if (
      ts.isJsxExpression(node) &&
      node.parent &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
      literal(node) &&
      !trustedTextAdapter &&
      !indexOnly
    )
      add(node, "literal-text", node.getText(ast));
    if (
      ts.isJsxAttribute(node) &&
      sinks.has(node.name.getText(ast)) &&
      node.initializer &&
      literal(node.initializer)
    )
      add(node, "literal-attribute", node.getText(ast));
    if (
      ts.isPropertyAssignment(node) &&
      sinks.has(node.name.getText(ast).replace(/["']/g, "")) &&
      literal(node.initializer)
    )
      add(node, "literal-property", node.getText(ast));
    if (
      ts.isJsxAttribute(node) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      (node.name.getText(ast) === "data-ui" ||
        (node.name.getText(ast) === "id" &&
          node.initializer.text.includes("."))) &&
      !currentId(node.initializer.text)
    )
      add(node, "unknown-or-future-id", node.initializer.text);
    if (
      ts.isPropertyAssignment(node) &&
      ts.isStringLiteralLike(node.initializer)
    ) {
      const key = node.name.getText(ast).replace(/["']/g, "");
      const value = node.initializer.text;
      if (
        /color|background|fill|stroke|border/i.test(key) &&
        /#[\da-f]{3,8}\b|\b(?:rgb|hsl|oklch)\(|^(?:white|black|red|blue|green)$/i.test(
          value,
        )
      )
        add(node, "inline-color", value);
      if (/[/\\]screens[/\\]/.test(file) && /[-\d.]+px\b/.test(value))
        add(node, "inline-screen-pixels", value);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "t" &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      !currentId(node.arguments[0].text)
    )
      add(node, "unknown-or-future-id", node.arguments[0].text);
  });
  return findings;
}
export function scanCss(file: string, source: string): Finding[] {
  if (file.endsWith("tokens.css")) return [];
  const findings: Finding[] = [];
  const ast = postcss.parse(source, { from: file });
  ast.walkDecls((decl) => {
    const value = decl.value.replace(/var\([^)]*\)/g, "");
    if (
      /(#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(|\b(?:white|black|red|blue|green|navy|gray|grey|orange|yellow|purple|pink)\b)/i.test(
        value,
      )
    )
      findings.push({
        file,
        line: decl.source?.start?.line ?? 0,
        rule: "raw-color",
        detail: decl.toString(),
      });
    if (
      /[/\\]screens[/\\]/.test(file) &&
      /(?:^|[^a-z])[-\d.]+px\b/i.test(value)
    )
      findings.push({
        file,
        line: decl.source?.start?.line ?? 0,
        rule: "screen-pixels",
        detail: decl.toString(),
      });
  });
  return findings;
}
export function inspectSsr(html: string): { ids: string[]; errors: string[] } {
  const ids = [...html.matchAll(/data-(?:ui|text-id)="([^"]+)"/g)].map(
    (match) => match[1]!,
  );
  return {
    ids: [...new Set(ids)],
    errors: ids
      .filter((id) => !currentId(id))
      .map((id) => `Unknown or future row: ${id}`),
  };
}
