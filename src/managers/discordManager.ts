import { Client, Presence } from "discord-rpc";

import Song from "@classes/Song";
import { iTunesProps } from "@interfaces/iTunes";
import { formatTime } from "@util/formatTime";

import { APP_ID, logger } from "../config";
import { initApp, vars } from "../index";

export let rpcClient: DiscordClient;

class DiscordClient {
	clientId: string;
	private client: Client;
	private ready = false;
	actualPresence!: Presence;

	constructor() {
		rpcClient = this;
		this.clientId = APP_ID;
		this.client = new Client({
			transport: "ipc"
		});

		this.client.on("ready", () => {
			this.ready = true;
			this.setActivity();
		});

		this.client.on(
			// @ts-ignore
			"disconnected",
			() => {
				this.destroyClient();
				rpcClient = undefined!;
				clearInterval(vars.loopTimer);
				vars.loopTimer = setInterval(() => {
					initApp();
				}, 5000);
				this.loginClient();
			}
		);

		this.loginClient();
	}

	loginClient() {
		this.client
			.login({ clientId: this.clientId })
			.catch(err => console.error(err));
	}

	setActivity(data?: Presence) {
		data = data ? data : this.actualPresence;
		if (!this.ready) return;

		this.client.setActivity(data).catch(() => this.client.destroy());
	}

	clearActivity() {
		if (!this.ready) return;

		this.client.clearActivity().catch(() => this.client.destroy());
	}

	destroyClient() {
		if (!this.ready) return;

		this.client.destroy();
	}
}

export const setActivity = (presenceData: Presence, song: Song) => {
		if (!presenceData) return clearActivity();

		if (song.state === "playing") return;

		logger.extend("discordManager").extend("setActivity")(
			`Now playing; ${song.artist} - ${song.title}. Duration: ${formatTime(
				song.duration as number
			)}`
		);

		if (!rpcClient) {
			rpcClient = new DiscordClient();
			rpcClient.actualPresence = presenceData;
		} else rpcClient.setActivity(presenceData);
	},
	clearActivity = () => {
		if (!rpcClient) return;
		rpcClient.clearActivity();
	},
	destroyClient = () => {
		if (!rpcClient) return;
		rpcClient.destroyClient();
	};
