import { client } from "@xmpp/client";
import { JID } from "@xmpp/jid";
import { JitsiJoinConference } from "./xmpp/JitsiJoinConf";
import { RTCPeerConnection, RTCSessionDescription, RTCPeerConnectionIceEvent, RTCIceCandidate, nonstandard } from 'wrtc';
import xml, { Element } from "@xmpp/xml";
import { Jingle2SDP, SDP2Jingle, candidatesToJingle, candidateFromJingle } from "./JingleSDP";
import { v4 as uuid } from "uuid";
import { EventEmitter } from "events";
import { DiscoInfoResponse } from "./xmpp/DiscoInfoResponse";

const { RTCAudioSource, RTCAudioSink } = nonstandard;

export class JitsiClient extends EventEmitter {
    private client: any;
    private state: "offline"|"connecting"|"online"|"error";
    private identity?: JID;
    private peerConnection?: RTCPeerConnection;
    private audioSink?: any; //RTCAudioSink;
    private remoteAudioSinks: {[trackName: string]: any} = {};
    private sources: any[] = [];
    private remoteId?: string;
    private myLocalId?: string;
    private sid?: string;
    private localCandidateBatch?: RTCIceCandidate[];
    constructor(urlOrHost: string, domain: string, private conferenceDomain: string) {
        super();
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
        if (!this.myLocalId) {
            // HACK TO DETERMINE LOCAL IDENTITY
            this.myLocalId = to;
        }
        if (jingleElement) {
            // We need to ack this immediately.
            this.client.write(`<iq from='${to}' to='${from}' id='${id}' type='result'/>`);
            return this.onJingle(jingleElement as xml.Element, from, to);
        }
        if (stanza.getChild("ping")) {
            return this.client.write(`<iq from='${to}' to='${from}' id='${id}' type='result'/>`)
        }
        if (stanza.getChildByAttr("xmlns", "http://jabber.org/protocol/disco#info")) {
            return this.client.write(new DiscoInfoResponse(id, from))
        }
        console.log(stanza.toString());
    }

    private async onRemoteIceCandidate(stanza: Element, from: string, to: string) {
        //https://github.com/jitsi/lib-jitsi-meet/blob/b012353d68a584086982d654f5403bc235776b4b/modules/xmpp/JingleSessionPC.js#L749-L770
        stanza.getChildren("content").forEach((content) => {
            const transport = content.getChild("transport");
            const usernameFragment = transport?.attrs.ufrag;
            content.getChild("transport")?.getChildren("candidate").forEach((candidateElem) => {
                let line = candidateFromJingle(candidateElem as Element);
                line = line.replace('\r\n', '').replace('a=', '');

                // FIXME this code does not care to handle
                // non-bundle transport
                const rtcCandidate = new RTCIceCandidate({
                    sdpMLineIndex: 0,
                    sdpMid: '',
                    candidate: line
                });
                const candidate = new RTCIceCandidate(rtcCandidate);
                this.peerConnection.addIceCandidate(candidate);
                console.log(`Added new candidate ${candidate}`)
            });
        });
    }

    private onLocalIceCandidate(evt: RTCPeerConnectionIceEvent) {
        if (evt.candidate !== null) { 
            this.localCandidateBatch!.push(evt);
            return;
        }
        console.log("Got last candidate, pushing");
        const jingleElem = candidatesToJingle(this.localCandidateBatch!);
        jingleElem.attr("sid", this.sid);
        jingleElem.attr("initiator", this.remoteId);
        this.client.send(xml("iq", {
            to: this.remoteId,
            from: this.myLocalId,
            type: "set",
            id: uuid(),
            xmlns: "jabber:client",
        }, jingleElem));
    }

    private onTrack(evt: RTCTrackEvent) {
        console.log("OnTrack:", evt);
        console.log(evt.track);
        if (evt.track.kind === "audio") {
            console.log("Track is audio");
            let sink = this.remoteAudioSinks[evt.track.id] = new RTCAudioSink(evt.track);
            sink.ondata = (data) => {
                console.log("DATA:", data);
            };
        }
    }

    private initalisePeerConnection() {
        this.peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ], // We should define some.
            sdpSemantics: 'unified-plan',
        });
        this.peerConnection.onicecandidate = (evt) => this.onLocalIceCandidate(evt);
        this.peerConnection.ontrack = this.onTrack.bind(this);
        this.peerConnection.onnegotiationneeded = (...args) => console.log("onnegotiationneeded", args);
        this.peerConnection.onremovetrack = (...args) => console.log("onremovetrack", args);
        this.peerConnection.onconnectionstatechange = (...args) => console.log("onconnectionstatechange", this.peerConnection.connectionState);
        this.peerConnection.oniceconnectionstatechange = (...args) => console.log("oniceconnectionstatechange", this.peerConnection.iceConnectionState);
        this.peerConnection.onicegatheringstatechange= (...args) => console.log("onicegatheringstatechange", this.peerConnection.iceGatheringState);
        this.peerConnection.onsignalingstatechange= (...args) => console.log("onsignalingstatechange", this.peerConnection.signalingState);
    }

    private async onJingle(stanza: Element, from: string, to: string) {
        const action = stanza.attr("action");
        const sid = stanza.attr("sid");
        if (action === "transport-info") {
            if (!this.peerConnection) {
                console.warn("Cannot handle transport-info: peerConnection not set");
                return;
            }
            this.onRemoteIceCandidate(stanza, from, to);
            return;
        }
        if (action !== "session-initiate") {
            console.log("Not sure how to handle", action, from);
            return;
        }
        if (this.peerConnection) {
            console.log("Already have a peer connection!");
            return;
        }
        this.initalisePeerConnection();
        this.sid = sid;
        this.remoteId = from;
        this.localCandidateBatch = [];
        const channel = this.peerConnection.createDataChannel(
            'JVB data channel', {
                protocol: 'http://jitsi.org/protocols/colibri'
            }
        );
        channel.onopen = function(event) {
            channel.send('Hi you!');
        }
        channel.onmessage = function(event) {
            console.log(event.data);
        }
        const sdp = Jingle2SDP(stanza, "", "responder", "incoming");
        console.log(sdp);
        const description = new RTCSessionDescription();
        description.type = "offer";
        description.sdp = sdp;
        try {
            await this.peerConnection.setRemoteDescription(description);
            // Add tracks
            this.sources.forEach((s) => {
                this.peerConnection.addTrack(s.createTrack());
            })
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
        answerElement.attr("sid", sid);
        console.log("SENDING ANSWER");
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

    public addSource(arg0: any) {
        this.sources.push(arg0);
    }
}

