import { spawn } from "child_process";
import { join } from "path";
import { EventEmitter, EventSource } from "@hediet/std/events";
import { TypedChannel } from "@hediet/typed-json-rpc";
import { NodeJsMessageStream } from "@hediet/typed-json-rpc-streams";
import { debuggerProxyContract } from "./contract";
import { startInterval } from "@hediet/std/timer";
import { Disposable } from "@hediet/std/disposable";

export function launchProxyServer(
	port: number
): Promise<{
	port: number;
	onClientConnected: EventSource;
	signalExit: () => void;
}> {
	const onClientConnected = new EventEmitter();
	return new Promise(resolve => {
		const entry = join(__dirname, "./entry.js");
		const proc = spawn("node", [entry, port.toString()], {
			detached: true,
			shell: false,
			windowsHide: true,
		});

		proc.on("error", e => {
			console.error("error", e);
		});
		proc.on("close", e => {
			console.error("closed", e);
		});

		let keepAliveTimer: Disposable;
		const { server } = debuggerProxyContract.getServerFromStream(
			NodeJsMessageStream.connectToProcess(proc),
			undefined,
			{
				serverStarted: ({ port }) => {
					resolve({
						port,
						onClientConnected: onClientConnected.asEvent(),
						signalExit: () => {
							keepAliveTimer.dispose();
						},
					});
				},
				clientConnected: () =>
					onClientConnected.emit(undefined, undefined),
			}
		);
		keepAliveTimer = startInterval(1000, () => {
			server.keepAlive({});
		});

		proc.stderr!.on("data", chunk => {
			console.error(chunk.toString("utf8"));
		});
	});
}