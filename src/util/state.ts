import "@jxa/global-type";

import { iTunesProps } from "@interfaces/iTunes";
import { run } from "@jxa/run";

export const isOpen = async (): Promise<boolean> => {
		return await run(() =>
			Application("System Events").processes["Music"].exists()
		);
	},
	getState = async (): Promise<string> => {
		return await run(() => {
			// @ts-expect-error: 'Music' replaced 'iTunes' on Catalina and later
			const music: Application._iTunes = Application(
				"Music"
			) as Application._iTunes;
			return music.playerState();
		});
	},
	getProps = async (): Promise<iTunesProps> => {
		return await run(() => {
			// @ts-expect-error: 'Music' replaced 'iTunes' on Catalina and later
			const music: Application._iTunes = Application("Music");
			return {
				...music.currentTrack().properties(),
				playerPosition: music.playerPosition()
			};
		});
	};
