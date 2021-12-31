import debug from "debug";
import { textSync } from "figlet";

import MusicManager from "@managers/musicManager";

import { logger } from "./config";

export class vars {
	public static loopTimer: NodeJS.Timer;
}

const showFiglet = async () => {
		console.log(textSync("Apple Music Discord RPC"));
	},
	start = async () => {
		debug.enable("am-discord-rpc*");
		showFiglet();
		initApp();
	};

export const initApp = async () => {
	logger.extend("rpcLoop")("Starting RPC loop");

	const am = new MusicManager();

	am.rpcLoop();
	vars.loopTimer = setInterval(() => {
		am.rpcLoop();
	}, 5000);
};

start();
