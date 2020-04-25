import { client } from "@xmpp/client";
import { JID } from "@xmpp/jid";
import { JitsiPresence, JitsiUserPresence } from "./xmpp/JitsiPresence";
import { RTCPeerConnection, RTCSessionDescription, RTCPeerConnectionIceEvent, RTCIceCandidate, nonstandard } from 'wrtc';
import xml, { Element } from "@xmpp/xml";
import { Jingle2SDP, SDP2Jingle, candidatesToJingle, candidateFromJingle } from "./JingleSDP";
import { v4 as uuid } from "uuid";
import { EventEmitter } from "events";
import { DiscoInfoResponse } from "./xmpp/DiscoInfoResponse";
import { ILogger, DummyLogger, LoggerFunc } from "./Logger";
import { url } from "inspector";

const { RTCAudioSource, RTCAudioSink } = nonstandard;

export interface JitsiClientOpts {
    logger?: LoggerFunc,
    iceServers?: {urls: string}[],
    nick: string,
    email?: string,
}

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
    private clientPresence: JitsiUserPresence;
    private roomName!: string;
    private logger: ILogger;
    constructor(urlOrHost: string, domain: string, private conferenceDomain: string, private opts: JitsiClientOpts) {
        super();
        this.logger = opts.logger ? opts.logger('JitsiClient') : new DummyLogger();
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
        this.clientPresence = {
            audioMuted: false,
            videoMuted: true,
            email: opts.email,
            nick: opts.nick,
            handRaised: true,
        };
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
        this.logger.info("Joining conference", roomName);
        this.roomName = roomName;
        if (this.state !== "online" || !this.identity) {
            throw Error("Cannot join, not connected");
        }
        this.client.write(new JitsiPresence(
            this.roomName,
            this.conferenceDomain,
            this.identity.resource,
            this.clientPresence,
            true,
        ).xml);
    }

    private onStanza(stanza: Element) {
        //this.logger.debug("XMPP RX:", stanza);
        let promise: Promise<unknown>|null = null;
        if (stanza.is("iq")) {
            promise = this.onIq(stanza);
        }
        if (!promise) {
            return;
        }
        promise.catch((err) => {
            this.logger.debug("Failed to handle stanza:", err);
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
            return this.client.write(new DiscoInfoResponse(id, from).xml)
        }
        this.logger.debug(stanza.toString());
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
                this.logger.debug(`Added new candidate`, candidate.candidate);
            });
        });
    }

    private onLocalIceCandidate(evt: RTCPeerConnectionIceEvent) {
        if (evt.candidate !== null) { 
            this.localCandidateBatch!.push(evt);
            return;
        }
        const candidateCount = this.localCandidateBatch?.length || 0;
        this.logger.debug(`Got last candidate. Pushing ${candidateCount} candidates`);
        if (candidateCount === 0) {
            this.logger.warn(`No candidates in batch!`);
            return;
        }
        const jingleElem = candidatesToJingle(this.localCandidateBatch!);
        this.localCandidateBatch = [];
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
        this.logger.debug("OnTrack:", evt);
        this.logger.debug(evt.track, evt.track.kind);
        if (evt.track.kind === "audio") {
            this.logger.debug("Track is audio");
            let sink = this.remoteAudioSinks[evt.track.id] = new RTCAudioSink(evt.track);
            sink.ondata = (data) => {
                this.logger.debug("DATA:", data);
            };
        }
    }

    private onDataChannel(evt: RTCDataChannelEvent) {
        this.logger.debug('Data channel is created!');
        evt.channel.onopen = () => {
          this.logger.debug('Data channel is open and ready to be used.');
        };
    }

    private onConnectionStateChange(state) {
        this.logger.info("Peer connection state change", state);
        if (state === "connecting") {
            // Resend presence
            this.client.write(new JitsiPresence(
                this.roomName,
                this.conferenceDomain,
                this.identity!.resource,
                this.clientPresence,
                false,
            ).xml);        }
    }

    private initalisePeerConnection() {
        this.logger.debug("Creating new peer connection");
        this.peerConnection = new RTCPeerConnection({
            iceServers: this.opts.iceServers,
            sdpSemantics: 'unified-plan',
        });
        this.peerConnection.onicecandidate = (evt) => this.onLocalIceCandidate(evt);
        this.peerConnection.ontrack = this.onTrack.bind(this);
        this.peerConnection.ondatachannel = this.onDataChannel.bind(this);
        this.peerConnection.onnegotiationneeded = (...args) => this.logger.debug("onnegotiationneeded", args);
        this.peerConnection.onremovetrack = (...args) => this.logger.debug("onremovetrack", args);
        this.peerConnection.onconnectionstatechange = () => this.onConnectionStateChange(this.peerConnection.connectionState);
        this.peerConnection.oniceconnectionstatechange = () => this.logger.debug("oniceconnectionstatechange", this.peerConnection.iceConnectionState);
        this.peerConnection.onicegatheringstatechange= () => this.logger.debug("onicegatheringstatechange", this.peerConnection.iceGatheringState);
        this.peerConnection.onsignalingstatechange= () => this.logger.debug("onsignalingstatechange", this.peerConnection.signalingState);
    }

    private async onJingle(stanza: Element, from: string, to: string) {
        const action = stanza.attr("action");
        const sid = stanza.attr("sid");
        if (action === "transport-info") {
            if (!this.peerConnection) {
                this.logger.warn("Cannot handle transport-info: peerConnection not set");
                return;
            }
            this.onRemoteIceCandidate(stanza, from, to);
            return;
        }
        if (action !== "session-initiate") {
            this.logger.debug(stanza.toString());
            this.logger.debug("Not sure how to handle", action, from);
            return;
        }
        if (from.endsWith("focus")) {
            this.logger.debug("Got req from focus, ignoring so we can use P2P");
            // Hack: Force use of P2P
            return;
        }
        this.logger.debug(`Got session-initiate from ${from}`);
        if (this.peerConnection) {
            this.logger.debug(`Ignoring request for new peer connection`);
            return;
            // this.logger.debug("Already had a peer connection, creating new one");
            // this.peerConnection.close();
        }
        this.initalisePeerConnection();
        this.sid = sid;
        this.remoteId = from;
        this.localCandidateBatch = [];
        const sdp = Jingle2SDP(stanza, "", "responder", "incoming");
        const description = new RTCSessionDescription();
        description.type = "offer";
        description.sdp = sdp;
        try {
            this.logger.debug("Setting remote description");
            await this.peerConnection.setRemoteDescription(description);
            // Add tracks
            const channel = this.peerConnection.createDataChannel(
                'JVB data channel', {
                    protocol: 'http://jitsi.org/protocols/colibri'
                }
            );
            channel.onopen = function(event) {
                this.logger.debug("OPEN");
                channel.send('Hi you!');
            }
            channel.onmessage = function(event) {
                this.logger.debug(event.data);
            }
            this.sources.forEach((s) => {
                this.peerConnection.addTrack(s.createTrack());
            })
            const answer = await this.peerConnection.createAnswer();
            this.peerConnection.setLocalDescription(answer);
            return this.sendSDPAnswer(to, from, answer.sdp, sid);
        } catch (ex) {
            this.logger.error('Failed to handle session-initiate', ex);
            this.emit('error', Error('Failed to handle session-initiate' + ex));
        }
    }

    private async sendSDPAnswer(from: string, to: string, sdp: string, sid: string) {
        const answerElement = SDP2Jingle(sdp, "responder", "outgoing");
        answerElement.attr("action", "session-accept");
        answerElement.attr("responder", from);
        answerElement.attr("sid", sid);
        this.logger.debug("Sending SDP answer");
        return this.client.send(xml("iq", {
            from,
            to,
            type: 'set',
            id: uuid(),
        }, answerElement));
    }

    private onError(err) {
        this.state = "error";
        this.logger.error("XMPP ERROR:", err);
    }

    private onOffline() {
        this.state = "offline";
        this.logger.warn("XMPP OFFLINE");
    }

    private onOnline(myJid: JID) {
        this.state = "online";
        this.identity = myJid;
        this.logger.info("Connected to XMPP server as", myJid.toString());
    }

    public addSource(arg0: any) {
        this.sources.push(arg0);
    }
}

