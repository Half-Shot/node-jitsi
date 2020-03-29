import {xml, jid, Client} from "@xmpp/client-core";
import { BoshConnection } from "./xmpp/BoshConnection";

export class JitsiClient {
    private xmppClient: any;
    constructor(private boshUrl: string, private domain: string) {
        this.xmppClient = new Client({domain, service: boshUrl});
        BoshConnection.applyToClient(this.xmppClient);
        this.xmppClient.on("element", (e) => {
            console.log("Woo2", e);
        });
    }

    public async connect(roomName: string) {
        await this.xmppClient.start();
    }
}

