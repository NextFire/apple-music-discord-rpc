import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

import { iTunesInfo } from "@interfaces/iTunes";

export default class CacheManager {
	private cache: Map<number, iTunesInfo>;
	private cacheSize: number;
	private cacheLimit: number;

	constructor(cacheLimit: number) {
		this.cache = new Map();
		this.cacheSize = 0;
		this.cacheLimit = cacheLimit;

		this.create();
		this.load();
	}

	//* Create cache file
	public async create() {
		if (
			(await existsSync("cache")) &&
			(await readFileSync("cache/info.json", "utf8"))
		)
			return;
		try {
			await mkdirSync("cache");
			await writeFileSync("cache/info.json", "[]");
		} catch (err) {
			console.error(err);
		}
	}

	//* Load cache from file
	public async load() {
		try {
			const data = await readFileSync("cache/info.json", "utf8");
			this.cache = new Map(JSON.parse(data));
			this.cacheSize = this.cache.size;
		} catch (err) {
			console.error(err);
		}
	}

	//* Get index from cache
	public get(id: number): iTunesInfo | undefined {
		return this.cache.get(id);
	}

	//* Set index in cache
	public set(id: number, infos: iTunesInfo) {
		if (this.cacheSize >= this.cacheLimit) {
			this.cache.delete(this.cache.keys().next().value);
			this.cacheSize--;
		}
		this.cache.set(id, infos);
		this.cacheSize++;
		this.save();
	}

	//* Save cache to file
	public async save() {
		try {
			await writeFileSync(
				"cache/info.json",
				JSON.stringify(Array.from(this.cache.entries()), undefined, 2)
			);
		} catch (err) {
			console.error(err);
		}
	}
}
