/**
 * Vendored dependency: discord_rpc v0.3.2
 *
 * Copyright (c) littledivy & Harmony Land
 * SPDX-License-Identifier: MIT
 *
 * Upstream: https://github.com/harmonyland/discord_rpc
 *
 * This copy contains local modifications.
 */

export enum ActivityType {
  Playing = 0,
  Streaming = 1,
  Listening = 2,
  Watching = 3,
  Custom = 4,
  Competing = 5,
}

export interface Activity {
  /** Activity type, e.g. `ActivityType.Listening` for "Listening to X" */
  type?: ActivityType;
  /** https://github.com/discord/discord-api-docs/pull/7674 */
  status_display_type?: number;
  /** https://github.com/discord/discord-api-docs/pull/7674 */
  details_url?: string;
  /** https://github.com/discord/discord-api-docs/pull/7674 */
  state_url?: string;
  details?: string;
  state?: string;
  assets?: {
    large_image?: string;
    large_text?: string;
    /** https://github.com/discord/discord-api-docs/pull/7674 */
    large_url?: string;
    small_image?: string;
    small_text?: string;
    small_url?: string;
  };
  party?: {
    id?: string;
    size?: number;
  };
  timestamps?: {
    start?: number;
    end?: number;
  };
  secrets?: {
    match?: string;
    join?: string;
    spectate?: string;
  };
  buttons?: {
    label?: string;
    url?: string;
  }[];
}

enum OpCode {
  HANDSHAKE,
  FRAME,
  CLOSE,
  PING,
  PONG,
}

interface ClientOptions {
  id: string;
}

interface PromiseController {
  resolve: CallableFunction;
  reject: CallableFunction;
}

function encode(op: number, payloadString: string) {
  const payload = new TextEncoder().encode(payloadString);
  const data = new Uint8Array(4 + 4 + payload.byteLength);
  const view = new DataView(data.buffer);
  view.setInt32(0, op, true);
  view.setInt32(4, payload.byteLength, true);
  data.set(payload, 8);
  return data;
}

function getIPCPath(id: number) {
  if (id < 0 || id > 9) throw new RangeError(`IPC ID must be between 0-9`);

  const suffix = `discord-ipc-${id}`;
  const prefix = (Deno.env.get("XDG_RUNTIME_DIR") ?? Deno.env.get("TMPDIR") ??
    Deno.env.get("TMP") ?? Deno.env.get("TEMP") ?? "/tmp") + "/";

  return `${prefix}${suffix}`;
}

async function findIPC(id = 0): Promise<Deno.Conn> {
  const path = getIPCPath(id);
  try {
    return await Deno.connect({
      path,
      transport: "unix",
    });
  } catch (_) {
    return findIPC(id + 1);
  }
}

class DiscordIPC {
  #ipcHandle: Deno.Conn;
  #_eventLoop!: Promise<void>;
  #breakEventLoop?: boolean;
  #header = new Uint8Array(8);
  #headerView = new DataView(this.#header.buffer);
  #commandQueue = new Map<
    string,
    PromiseController
  >();
  #readyHandle?: PromiseController;

  constructor(conn: Deno.Conn) {
    this.#ipcHandle = conn;
    this.#startEventLoop();
  }

  static async connect() {
    const conn = await findIPC();
    return new DiscordIPC(conn);
  }

  #startEventLoop() {
    this.#_eventLoop = (async () => {
      try {
        while (true) {
          if (this.#breakEventLoop === true) break;
          await this.#read();
        }
      } catch (_) {
        this.#breakEventLoop = true;
      }
    })();
  }

  /**
   * Send a packet to Discord IPC. Returns nonce.
   *
   * Nonce is generated if the payload does not have a `nonce` property
   * and is added to payload object too.
   *
   * If payload object does contain a nonce, then it is returned instead.
   */
  async send<T extends Record<string, unknown>>(op: OpCode, payload: T) {
    if (typeof payload !== "object" || payload === null) {
      throw new TypeError("Payload must be an object");
    }

    let nonce: string;
    if (typeof payload.nonce === "undefined") {
      nonce = crypto.randomUUID();
      Object.defineProperty(payload, "nonce", {
        value: nonce,
      });
    } else {
      nonce = payload.nonce as string;
    }

    const data = encode(op, JSON.stringify(payload));
    await this.#ipcHandle.write(data);
    return nonce;
  }

  /**
   * Sends a Managed Command to Discord IPC.
   *
   * Managed means it resolves when Discord sends back some response,
   * or rejects when an ERROR event is DISPATCHed instead.
   *
   * @param cmd Command name
   * @param args Arguments object
   * @returns Command response
   */
  sendCommand<
    T = unknown,
    T2 extends Record<string, unknown> = Record<string, unknown>,
  >(
    cmd: string,
    args: T2,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const nonce = crypto.randomUUID();
      this.#commandQueue.set(nonce, { resolve, reject });
      this.send(OpCode.FRAME, {
        cmd,
        args,
        nonce,
      }).catch(reject);
    });
  }

  /**
   * Performs initial handshake.
   *
   * @param clientID Application ID from Developer Portal
   */
  login(clientID: string) {
    return new Promise<unknown>((resolve, reject) => {
      this.#readyHandle = { resolve, reject };
      this.send(OpCode.HANDSHAKE, { v: "1", client_id: clientID }).catch(
        reject,
      );
    });
  }

  /**
   * Closes the connection to Discord IPC Socket.
   */
  close() {
    this.#breakEventLoop = true;
    this.#ipcHandle.close();
  }

  async #read() {
    let headerRead = 0;
    while (headerRead < 8) {
      const read = await this.#ipcHandle.read(
        this.#header.subarray(headerRead),
      );
      if (read === null) throw new Error("Connection closed");
      headerRead += read;
    }

    const op = this.#headerView.getInt32(0, true) as OpCode;
    const payloadLength = this.#headerView.getInt32(4, true);

    const data = new Uint8Array(payloadLength);
    let bodyRead = 0;
    while (bodyRead < payloadLength) {
      const read = await this.#ipcHandle.read(data.subarray(bodyRead));
      if (read === null) throw new Error("Connection closed");
      bodyRead += read;
    }

    const payload = JSON.parse(new TextDecoder().decode(data));

    const handle = this.#commandQueue.get(payload.nonce);
    if (handle) {
      if (payload.evt === "ERROR") {
        handle.reject(
          new Error(`(${payload.data.code}) ${payload.data.message}`),
        );
      } else {
        handle.resolve(payload.data);
      }
      this.#commandQueue.delete(payload.nonce);
    } else if (payload.cmd === "DISPATCH" && payload.evt === "READY") {
      this.#readyHandle?.resolve(payload.data);
      this.#readyHandle = undefined;
    } else if (op === OpCode.CLOSE && payload.code === 4000) {
      this.#readyHandle?.reject(
        new Error(`Connection closed (${payload.code}): ${payload.message}`),
      );
      this.#readyHandle = undefined;
    }
  }
}

export class Client {
  ipc?: DiscordIPC;

  constructor(public options: ClientOptions) {}

  async connect() {
    this.ipc = await DiscordIPC.connect();
    await this.ipc.login(this.options.id);
    return this;
  }

  /**
   * Set Presence Activity
   */
  setActivity(activity?: Activity) {
    return this.ipc!.sendCommand<
      Activity & { application_id: string; type: number }
    >(
      "SET_ACTIVITY",
      {
        pid: Deno.pid,
        activity,
      },
    );
  }

  /**
   * Clears the currently set activity, if any.
   * This will hide the "Playing X" message displayed below the user's name.
   */
  clearActivity() {
    return this.setActivity();
  }

  close() {
    this.ipc!.close();
  }
}
