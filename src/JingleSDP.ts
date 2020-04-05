import { Element, x } from "@xmpp/xml";
import { toSessionSDP, toSessionJSON } from 'sdp-jingle-json';
export function Jingle2SDP(jingleElement: Element, responder: string, role: string, direction: string) {
    const groups = jingleElement.getChildren("group")!.map((groupEl) => ({
        semantics: groupEl.getAttr('semantics'),
        // TODO: Fix application -- Not sure what to do, it doens't give us a payload type.
        contents: groupEl.getChildren("content").map((el) => el.getAttr('name')).filter((name) => name !== 'data'),
    }));


    const contents = jingleElement.getChildren("content").filter((e) => {
        // TODO: Fix application -- Not sure what to do, it doens't give us a payload type.
        return !(e.getChild("description")?.getAttr("media") === "application");
    }).map((e) => {
        const descriptionElement = e.getChild("description")!;
        const sources = descriptionElement.getChildren("sources").map((srcE) => ({
            ssrc: srcE.getAttr("ssrc"),
            parameters: srcE.getChildren("parameter").map((param) => ({
                key: param.getAttr("name"),
                value: param.getAttr("value"),
            })),
        }));
        const headerExtensions = descriptionElement.getChildren("rtp-hdrext").map((extE) => ({
            id: extE.getAttr("id"),
            uri: extE.getAttr("uri"),
        }));
        const payloads = descriptionElement.getChildren("payload-type").map((payloadType) => ({
            id: payloadType.getAttr("id"),
            channels: payloadType.getAttr("channels"),
            clockrate: payloadType.getAttr("clockrate"),
            maxptime: descriptionElement.getAttr("maxptime"),
            name: payloadType.getAttr("name"),
            parameters: payloadType.getChildren("payload-type").map((params) => ({
                key: params.getAttr("key"),
                value: params.getAttr("value"),
            })),
            feedback: payloadType.getChildren("rtcp-fb").map((params) => ({
                type: params.getAttr("type"),
                subtype: params.getAttr("subtype"),
            }))
        }));
        const application = {
            encryption: [],
            sourceGroups: [],
            ssrc: "",
            bandwidth: "",
            bandwidthType: "",
            applicationType: "rtp",
            media: descriptionElement.getAttr("media"),
            sources,
            headerExtensions,
            payloads,
            mux: !!descriptionElement.getChild("rtcp-mux"),
        }

        const transportElement = e.getChild("transport")!;
        const transport = {
            transportType: "",
            ufrag: transportElement.getAttr("ufrag"),
            pwd: transportElement.getAttr("pwd"),
            mux: !!transportElement.getChild("rtcp-mux"),
            //setup: transportElement.getChild("fingerpint")!.getAttr("setup"),
            candidates: transportElement.getChildren("candidate").map((candidate) => ({
                component: candidate.getAttr("component"),
                foundation: candidate.getAttr("foundation"),
                type: candidate.getAttr("type"),
                generation: candidate.getAttr("generation"),
                ip: candidate.getAttr("ip"),
                priority: candidate.getAttr("priority"),
                id: candidate.getAttr("id"),
                network: candidate.getAttr("network"),
                protocol: candidate.getAttr("protocol"),
                port: candidate.getAttr("port"),
            })),
            fingerprints: transportElement.getChildren("fingerprint").map((fp) => ({
              hash: fp.getAttr("hash"),
              value: fp.getText(),
            })),
        }
        return {
            name: e.getAttr("name"),
            creator: e.getAttr("creator"),
            senders: e.getAttr("senders"),
            application,
            transport,
        }
    });

    return toSessionSDP({
        action: jingleElement.attr("action"),
        initiator: jingleElement.attr("initiator"),
        responder,
        sid: jingleElement.attr("sid"),
        // ---- Content payload
        groups: groups,
        contents: contents,
    }, { role, direction});
}

/***
 * 
  contents: [
    {
      creator: 'responder',
      name: 'audio',
      application: [Object],
      transport: [Object],
      senders: 'initiator'
    },
    {
      creator: 'initiator',
      name: 'video',
      application: [Object],
      transport: [Object],
      senders: 'initiator'
    }
  ],
  groups: [ { semantics: 'BUNDLE', contents: [Array] } ]
}
*/

function SdpContentToElement(content) {
    const contentElement = x("content", {
        creator: content.creator,
        name: content.name,
        senders: content.senders,
    });
    const descriptionElement = x("description", {
        media: content.application.media,
        ssrc: content.application.ssrc,
        xmlns: "urn:xmpp:jingle:apps:rtp:1",
    });
    if (content.application.mux) {
        descriptionElement.append(x('rtcp-mux'));
    }
    content.application.payloads.forEach((payload) => {
        const payloadElement = x("payload-type", {
            channels: payload.channels,
            clockrate: payload.clockrate,
            id: payload.id,
            name: payload.name,
        });
        payload.parameters.forEach((params) => 
            payloadElement.append(x("parameter", {
                name: params.key,
                value: params.value,
            }))
        );
        payload.feedback.forEach((feedback) => 
            payloadElement.append(x("rtcp-fb", {
                id: feedback.id,
                type: feedback.type,
                subtype: feedback.subtype,
            }))
        );
        descriptionElement.append(payloadElement);
    });
    content.application.sources.forEach((source) => 
        descriptionElement.append(x("source", {
            ssrc: source.ssrc,
            xmlns: "urn:xmpp:jingle:apps:rtp:ssma:0",
        }, source.parameters.map((param => x("parameter", {
            name: param.key,
            value: param.value,
        })))))
    );
    content.application.headerExtensions.forEach((ext) => 
        descriptionElement.append(x("rtp-hdrext", {
            id: ext.id,
            senders: ext.senders,
            uri: ext.uri,
            xmlns: "urn:xmpp:jingle:apps:rtp:rtp-hdrext:0",
        }))
    );
    const transportElement = x("transport", {
        pwd: content.transport.pwd,
        ufrag: content.transport.ufrag,
        // TODO: unhardcode this.
        transportType: "urn:xmpp:jingle:transports:ice-udp:1",
    }, x("fingerprint", {
        hash: content.transport.hash,
        setup: content.transport.setup,
    }, content.transport.value));
    content.transport.candidates.forEach((candidate) => transportElement.append(x(
        "candidate",
        candidate,
    )));
        contentElement.append(descriptionElement);
    contentElement.append(transportElement);
    return contentElement;
}

export function CandidateFromJingle(cand: Element) {
    return cand.attrs;
}

export function SDP2Jingle(sdpBlob: string, role: string, direction: string) {
    const sdp = toSessionJSON(sdpBlob, {
        role,
        direction,
        creators: ["responder", "responder"], // One for audio, one for video.
    });
    const jingleElement = x("jingle", {
        xmlns: "urn:xmpp:jingle:1",
    });
    sdp.groups.forEach(group => {
        jingleElement.append(x("group", {
            semantics: group.semantics,
        }, group.contents.map(name => x("content", { name }))
        ));
    });
    sdp.contents.forEach(content => jingleElement.append(SdpContentToElement(content)));
    return jingleElement;
}

export function candidatesToJingle(candidates: RTCIceCandidate[]) {
    const ufrag = candidates[0].usernameFragment;
    const name = candidates[0].sdpMid;
    const transport = x("transport", {
        ufrag,
    });
    candidates.forEach((candidate) => {
        const candidateJson = {...candidate};
        delete candidateJson.candidate;
        transport.append(x("candidate", candidateJson));
    })
    const contentElem = x("content", {
        creator: "responder",
        name, // XXX: Guessing here.
    }, transport);
    return x("jingle", {
        action: "transport-info",
        xmlns: "urn:xmpp:jingle:1"
    }, contentElem);
}