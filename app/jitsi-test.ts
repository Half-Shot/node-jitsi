import { JitsiClient } from "../src/JitsiClient";

async function main() {
    const jitsiClient = new JitsiClient("https://jitsi.modular.im/http-bind", "jitsi.modular.im");
    await jitsiClient.connect('aaaaa');
}

main().then((result) => {
    console.log("Finished:", result)
}).catch((ex) => {
    console.error("Failed:", ex);
    process.exit(1);
})