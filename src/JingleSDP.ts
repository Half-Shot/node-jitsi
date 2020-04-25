import { Element, x } from "@xmpp/xml";
import { toSessionSDP, toSessionJSON } from 'sdp-jingle-json';

export function Jingle2SDP(jingleElement: Element, responder: string, role: string, direction: string) {
    const groups = jingleElement.getChildren("group")!.map((groupEl) => ({
        semantics: groupEl.getAttr('semantics'),
        contents: groupEl.getChildren("content").map((el) => el.getAttr('name')),
    }));

    console.log(jingleElement.toString());
    const contents = jingleElement.getChildren("content").map((e) => {
        const name = e.getAttr("name");
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
            // Do not parse any payloads with rtx.
        })).filter((p) => p.name !== 'rtx');
        const sourceGroups = descriptionElement.getChildren("ssrc-group").map((ssrcGroup) => ({
            semantics: ssrcGroup.getAttr("semantics"),
            sources: ssrcGroup.getChildren("source").map((e) => e.getAttr("ssrc")),
        }));
        const application = {
            encryption: [],
            sourceGroups,
            // bandwidth: {
            //     type: 
            //     bandwidth: 
            // }
            // More hacky naughiness
            applicationType: name === "data" ? "datachannel" : "rtp",
            media: descriptionElement.getAttr("media"),
            sources,
            headerExtensions,
            payloads,
            mux: !!descriptionElement.getChild("rtcp-mux"),
        }

        const transportElement = e.getChild("transport")!;
        const transport: any = {
            transportType: "iceUdp",
            ufrag: transportElement.getAttr("ufrag"),
            pwd: transportElement.getAttr("pwd"),
            mux: !!transportElement.getChild("rtcp-mux"),
            setup: transportElement.getChild("fingerprint")?.getAttr("setup"),
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
              setup: fp.getAttr("setup"),
              hash: fp.getAttr("hash"),
              value: fp.getText(),
            })),
            sctp: [],
        }
        const sctpmap = transportElement.getChildren("sctpmap");
        if (sctpmap.length) {
            transport.sctp.push(...sctpmap.map((e) => ({
                number: e.getAttr("number"),
                protocol: e.getAttr("protocol"),
                streams:  e.getAttr("streams"),
            })));
        }
        return {
            name,
            creator: e.getAttr("creator"),
            senders: e.getAttr("senders"),
            application,
            transport,
        }
    });

    const sdpObject = {
        action: jingleElement.attr("action"),
        initiator: jingleElement.attr("initiator"),
        responder,
        sid: jingleElement.attr("sid"),
        // ---- Content payload
        groups: groups,
        contents: contents,
    };

    return toSessionSDP(sdpObject, {role, direction});
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
    // Payloads not defined for data channels
    (content.application.payloads || []).forEach((payload) => {
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
    (content.application.sources || []).forEach((source) => 
        descriptionElement.append(x("source", {
            ssrc: source.ssrc,
            xmlns: "urn:xmpp:jingle:apps:rtp:ssma:0",
        }, source.parameters.map((param => x("parameter", {
            name: param.key,
            value: param.value,
        })))))
    );
    (content.application.headerExtensions || []).forEach((ext) => 
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

// Taken from https://github.com/jitsi/lib-jitsi-meet/blob/edfad5f51186d70c645c1c05ece88822c2486dc7/modules/xmpp/SDPUtil.js#L399
export function candidateFromJingle(cand: Element) {
    let line = 'a=candidate:';

    line += cand.attr('foundation');
    line += ' ';
    line += cand.attr('component');
    line += ' ';

    let protocol = cand.attr('protocol');

    line += protocol; // .toUpperCase(); // chrome M23 doesn't like this
    line += ' ';
    line += cand.attr('priority');
    line += ' ';
    line += cand.attr('ip');
    line += ' ';
    line += cand.attr('port');
    line += ' ';
    line += 'typ';
    line += ` ${cand.attr('type')}`;
    line += ' ';
    switch (cand.attr('type')) {
    case 'srflx':
    case 'prflx':
    case 'relay':
        if (cand.attr('rel-addr')
                && cand.attr('rel-port')) {
            line += 'raddr';
            line += ' ';
            line += cand.attr('rel-addr');
            line += ' ';
            line += 'rport';
            line += ' ';
            line += cand.attr('rel-port');
            line += ' ';
        }
        break;
    }
    if (protocol.toLowerCase() === 'tcp') {
        line += 'tcptype';
        line += ' ';
        line += cand.attr('tcptype');
        line += ' ';
    }
    line += 'generation';
    line += ' ';
    line += cand.attr('generation') || '0';

    return `${line}\r\n`;
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