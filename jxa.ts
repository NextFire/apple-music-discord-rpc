/**
 * Vendored dependency: jxa v0.0.3
 *
 * Copyright (c) pnlng
 * SPDX-License-Identifier: MIT
 *
 * Upstream: https://github.com/pnlng/jxa
 *
 * This copy contains local modifications.
 */

// deno-lint-ignore-file no-explicit-any

/**
 * Runs a JXA function in a separate osascript process.
 * The function is stringified and executed with the given arguments.
 */
export function run<R>(
  jxaFunction: (...args: any[]) => R,
  ...args: any[]
): Promise<R> {
  const code = `
  ObjC.import('stdlib');
  const args = JSON.parse($.getenv('OSA_ARGS'));
  const fn   = (${jxaFunction.toString()});
  const out  = fn.apply(null, args);
  JSON.stringify({ result: out });
  `;
  return runInOsascript(code, args);
}

const runInOsascript = async (code: string, args: any[]) => {
  const cmd = new Deno.Command("osascript", {
    args: ["-l", "JavaScript", "-e", code],
    env: { OSA_ARGS: JSON.stringify(args) },
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout: output, stderr: error } = await cmd.output();

  const decoder = new TextDecoder();

  if (error.length) handleError(decoder.decode(error));
  if (!output.length) return undefined;
  const outStr = decoder.decode(output).trim();
  try {
    return JSON.parse(outStr).result;
  } catch {
    return outStr;
  }
};

const handleError = (OsascriptMessage: string) => {
  const errorGroups = OsascriptMessage.match(
    /execution\serror:\sError:\s(?<type>\w+):\s(?<message>.+)\(-\d+\)/,
  )?.groups;
  const errorTypeString = errorGroups?.type ?? "";
  const errorMessage = errorGroups?.message?.trim() ??
    "An error occured";
  const errorMapping: Record<string, ErrorConstructor> = {
    Error: Error,
    EvalError: EvalError,
    RangeError: RangeError,
    ReferenceError: ReferenceError,
    SyntaxError: SyntaxError,
    TypeError: TypeError,
    URIError: URIError,
  };
  const errorType = errorMapping?.[errorTypeString] ?? Error;
  throw errorType(errorMessage);
};
