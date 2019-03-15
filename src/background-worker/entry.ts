import { notifyVsCode } from "./notifyVsCode";
import { launchServer } from "./launchChrome";
import { AttachContext, Result } from "./attachContext";
import { EventSource } from "@hediet/std/events";
import { Disposable, dispose } from "@hediet/std/disposable";
import { launchProxyServer } from "../debugger-proxy";

const args = process.argv.slice(2);
const debuggerPort = parseInt(args[0]);
const label = args.length > 1 ? args[1] : undefined;

launchProxyServer(debuggerPort).then(data => {
	launch(data.port, data.onClientConnected, data.signalExit);
});

async function launch(
	proxyPort: number,
	onClientConnected: EventSource,
	exited: () => void
) {
	const disposables = new Array<Disposable>();
	function exit() {
		dispose(disposables);
		exited();
		process.exit();
	}

	onClientConnected.one(() => {
		exit();
	});

	const context: AttachContext = {
		debuggerPort,
		proxyPort,
		disposables,
		exit,
		label,
		log: (message: string) => {
			if (process.env.DEBUG_EASY_ATTACH) {
				console.log(message);
			}
		},
	};

	const promises = new Array<Promise<Result>>();
	promises.push(notifyVsCode(context));
	promises.push(launchServer(context));

	const results = await Promise.all(promises);
	if (results.every(r => !r.successful)) {
		for (const result of results) {
			if (result.successful) {
				continue;
			}
			console.error(result.errorMessage);
		}
	}
}