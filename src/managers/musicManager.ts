import { DEFAULT_APP_ICON } from "config";
import { Presence } from "discord-rpc";

import MusicAPI from "@classes/musicAPI";
import Song from "@classes/Song";
import { iTunesInfo, iTunesProps } from "@interfaces/iTunes";
import { getMusicProcess } from "@util/getMusicProcess";

import { clearActivity, setActivity } from "./discordManager";

export default class MusicManager {
	amAPI: MusicAPI;
	#currentSong: Song;

	constructor() {
		this.amAPI = new MusicAPI();
		this.#currentSong = new Song();
	}

	public async rpcLoop() {
		const open = await getMusicProcess("isOpen");
		if (!open) return clearActivity();

		const state = await getMusicProcess("getState");
		switch (state) {
			case "playing":
				const props: iTunesProps = (await getMusicProcess(
						"getProps"
					)) as iTunesProps,
					infos: iTunesInfo = await this.amAPI.search(props),
					endTimestamp = Math.ceil(
						Date.now() + (props.duration - props.playerPosition) * 1000
					),
					year = props.year ? ` (${props.year})` : "",
					activity: Presence = {
						details: props.name,
						state: `${props.artist} — ${props.album}${year}`,
						endTimestamp,
						largeImageKey: infos.artwork,
						largeImageText: `${props.album}${year}`
					};

				if (infos.url) {
					activity.buttons = [
						{
							label: "Listen on Apple Music",
							url: infos.url
						}
					];
				}

				this.#currentSong.album = props.album;
				this.#currentSong.artist = props.artist;
				this.#currentSong.title = props.name;
				this.#currentSong.state =
					~["added", "playing"].indexOf(this.#currentSong?.state) &&
					this.#currentSong.title === props.name
						? "playing"
						: "added";
				this.#currentSong.duration = props.duration;

				return setActivity(activity, this.#currentSong);
			case "paused":
			case "stopped":
				if (this.#currentSong.title === undefined) return;
				this.#currentSong.state = "stopped";
				return clearActivity();
		}
	}
}
