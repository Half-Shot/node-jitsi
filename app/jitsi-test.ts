import { JitsiClient } from "../src/JitsiClient";
import { RTCAudioSourceSineWave } from "./sine-wave";
import { FancyLogger } from "../src";
// Allow self signed
const EVIL_GOOGLE_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
];

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0';
let jitsiClient: JitsiClient;
async function main() {
    jitsiClient = new JitsiClient("xmpp://jitsi.modular.im", "jitsi.modular.im", "conference.jitsi.modular.im", {
        logger: (s) => new FancyLogger(s),
        iceServers: EVIL_GOOGLE_ICE_SERVERS,
        nick: "Testing node-jitsi",
        email: "gravatar@half-shot.uk",
    });
    jitsiClient.addSource(new RTCAudioSourceSineWave());
    jitsiClient.once('error', (ex) => {
        console.error('Encountered a fatal error, exiting');
        process.exit(1);
    });
    await jitsiClient.connect();
    await jitsiClient.joinConference('testingbridge2');
}

main().catch((ex) => {
    console.error("Failed:", ex);
    process.exit(1);
})

process.on("beforeExit", () => {
    jitsiClient.disconnect();
});