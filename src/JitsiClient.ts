import { client } from "@xmpp/client";
import { JID } from "@xmpp/jid";
import { JitsiJoinConference } from "./xmpp/JitsiJoinConf";
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, nonstandard } from 'wrtc';
import xml, { Element } from "@xmpp/xml";
import { Jingle2SDP, SDP2Jingle, CandidateFromJingle } from "./JingleSDP";
import { v4 as uuid } from "uuid";

const { RTCAudioSource, RTCAudioSink } = nonstandard;

export class JitsiClient {
    private client: any;
    private state: "offline"|"connecting"|"online"|"error";
    private identity?: JID;
    private peerConnection?: RTCPeerConnection;
    private audioSource?: any; //RTCAudioSource;
    private audioSink?: any; //RTCAudioSink;
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
        //console.log("XMPP RX:", stanza);
        let promise: Promise<unknown>|null = null;
        if (stanza.is("iq")) {
            promise = this.onIq(stanza);
        }
        if (!promise) {
            return;
        }
        promise.catch((err) => {
            console.log("Failed to handle stanza:", err);
        });
    }

    private async onIq(stanza: Element) {
        const { from, to, id } = stanza.attrs;
        const jingleElement = stanza.getChild("jingle");
        console.log(stanza.toString());
        if (jingleElement) {
            // We need to ack this immediately.
            this.client.write(`<iq from='${to}' to='${from}' id='${id}' type='result'/>`);
            await this.onJingle(jingleElement as xml.Element, from, to);
        }
        if (stanza.getChild("ping")) {
            this.client.write(`<iq from='${to}' to='${from}' id='${id}' type='result'/>`)
        }
    }

    private async onIceCandidate(stanza: Element, from: string, to: string) {
        //https://github.com/jitsi/lib-jitsi-meet/blob/b012353d68a584086982d654f5403bc235776b4b/modules/xmpp/JingleSessionPC.js#L749-L770
        stanza.getChildren("content").forEach((content) => {
            content.getChild("transport")?.getChildren("candidate").forEach((candidate) => {
                this.peerConnection.addIceCandidate(new RTCIceCandidate({
                    sdpMLineIndex: 0,
    
                    // FF comes up with more complex names like audio-23423,
                    // Given that it works on both Chrome and FF without
                    // providing it, let's leave it like this for the time
                    // being...
                    // sdpMid: 'audio',
                    sdpMid: '',
                    line: CandidateFromJingle(candidate as Element),
                }));
            });
        });
    }

    private async sendAnswer() {

    }

    private async onJingle(stanza: Element, from: string, to: string) {
        const action = stanza.attr("action");
        const sid = stanza.attr("sid");
        if (action === "transport-info") {
            if (!this.peerConnection) {
                console.warn("Cannot handle transport-info: peerConnection not set");
                return;
            }
            this.onIceCandidate(stanza, from, to);
        }
        if (action !== "session-initiate") {
            console.log("Not sure how to handle", action, from);
            return;
        }
        if (this.peerConnection) {
            console.log("Already have a peer connection!");
            return;
        }
        this.peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ], // We should define some.
            sdpSemantics: 'unified-plan',
        });
        const sdp = Jingle2SDP(stanza, "", "responder", "incoming");
        const description = new RTCSessionDescription();
        description.type = "offer";
        description.sdp = sdp;
        try {
            await this.peerConnection.setRemoteDescription(description);
            // Add tracks
            this.audioSource = new RTCAudioSource();
            const track = this.audioSource.createTrack();
            this.peerConnection.addTrack(track);
            const answer = await this.peerConnection.createAnswer();
            this.peerConnection.setLocalDescription(answer);
            return this.sendSDPAnswer(to, from, answer.sdp, sid);
        } catch (ex) {
            console.log(ex);
            process.exit(1);
        }
    }

    private async sendSDPAnswer(from: string, to: string, sdp: string, sid: string) {
        const answerElement = SDP2Jingle(sdp, "responder", "outgoing");
        answerElement.attr("action", "session-accept");
        answerElement.attr("responder", from);
        answerElement.attr("sid", sid);;
        return this.client.send(xml("iq", {
            from,
            to,
            type: 'set',
            id: uuid(),
        }, answerElement));
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

