import { JitsiClient } from "../src/JitsiClient";

// Allow self signed

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0';
let jitsiClient: JitsiClient;
async function main() {
    jitsiClient = new JitsiClient("xmpp://jitsi.modular.im", "jitsi.modular.im", "conference.jitsi.modular.im");
    await jitsiClient.connect();
    await jitsiClient.joinConference('testingbridge3');
}

main().then((result) => {
    console.log("Finished:", result)
}).catch((ex) => {
    console.error("Failed:", ex);
    process.exit(1);
})

process.on("beforeExit", () => {
    jitsiClient.disconnect();
});