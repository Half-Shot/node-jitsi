import { client } from "@xmpp/client";
import { JID } from "@xmpp/jid";
import { JitsiJoinConference } from "./xmpp/JitsiJoinConf";
import { RTCPeerConnection, RTCSessionDescription } from 'wrtc';
import xml, { Element } from "@xmpp/xml";
import { Jingle2SDP } from "./JingleSDP";

export class JitsiClient {
    private client: any;
    private state: "offline"|"connecting"|"online"|"error";
    private identity?: JID;
    private peerConnection?: RTCPeerConnection;
    constructor(urlOrHost: string, domain: string, private conferenceDomain: string) {
        if (urlOrHost.startsWith("http")) {
            throw Error("BOSH is not supported yet");
        }
        this.state = "offline";
        this.client = client({
            service: urlOrHost,
            domain,
        });
        this.client.on("error", this.onError.bind(this));
        this.client.on("offline", this.onOffline.bind(this));
        this.client.on("online", this.onOnline.bind(this));
        this.client.on("stanza", this.onStanza.bind(this));
        urlOrHost.split(":");
    }

    public async connect() {
        this.state = "connecting";
        await this.client.start();
        await this.client.send(xml("presence"));
    }

    public async disconnect() {
        this.state = "offline";
        await this.client.disconnect();
    }

    public async joinConference(roomName: string) {
        console.log("Joining conference ", roomName);
        if (this.state !== "online" || !this.identity) {
            throw Error("Cannot join, not connected");
        }
        this.client.write(new JitsiJoinConference(
            roomName,
            this.conferenceDomain,
            this.identity.resource,
            "TestingAccount",
        ).xml);
    }

    private onStanza(stanza: Element) {
        console.log("XMPP RX:", stanza);
        let promise: Promise<unknown>|null = null;
        if (stanza.is("iq")) {
            promise = this.onIq(stanza);
        }
        if (!promise) {
            return;
        }
        promise.then(() => {

        }).catch((err) => {
            console.log("Failed to handle stanza:", err);
        });
    }

    private async onIq(stanza: Element) {
        const jingleElement = stanza.getChild("jingle");
        if (jingleElement) {
            await this.onJingle(jingleElement as xml.Element);
        }
    }

    private async onJingle(stanza: Element) {
        console.log("JINGLE:", stanza.toString());
        const action = stanza.attr("action");
        if (stanza.attr("action") !== "session-initiate") {
            console.log("Not sure how to handle this");
            return;
        }
        if (this.peerConnection) {
            console.log("Already have a peer connection!");
            return;
        }
        this.peerConnection = new RTCPeerConnection({
            iceServers: [] // We should define some.
        });
        const sdp = Jingle2SDP(stanza, "", "responder", "incoming");
        console.log(sdp);
        const description = new RTCSessionDescription();
        description.type = "answer";
        description.sdp = sdp;
        console.log(description);
        await this.peerConnection.setRemoteDescription(description);
        // Add tracks
        const answer = await this.peerConnection.createAnswer();
        this.peerConnection.setLocalDescription(answer);
        console.log(answer); // Need to send this back somehow.
    }

    private onError(err) {
        this.state = "error";
        console.log("XMPP ERROR:", err);
    }

    private onOffline() {
        this.state = "offline";
        console.log("XMPP OFFLINE");
    }

    private onOnline(myJid: JID) {
        this.state = "online";
        this.identity = myJid;
        console.log("XMPP ONLINE AS", myJid.toString());
    }
}

