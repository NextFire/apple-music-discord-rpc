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
    args: ["-l", "JavaScript"],
    env: { OSA_ARGS: JSON.stringify(args) },
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });
  const process = cmd.spawn();

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const writer = process.stdin.getWriter();
  await writer.write(encoder.encode(code));
  writer.releaseLock();
  await process.stdin.close();

  const { stderr: error, stdout: output } = await process.output();

  if (error.length) handleError(decoder.decode(error));
  const outStr = decoder.decode(output);
  if (!output.length) return undefined;
  try {
    const result = JSON.parse(outStr.trim()).result;
    return result;
  } catch {
    return outStr.trim();
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
