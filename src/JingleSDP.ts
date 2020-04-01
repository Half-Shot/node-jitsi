import { Element } from "@xmpp/xml";
import { toSessionSDP } from 'sdp-jingle-json';
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
        console.log(transport);
        return {
            name: e.getAttr("name"),
            creator: e.getAttr("creator"),
            senders: e.getAttr("senders"),
            application,
            transport,
        }
    });

    return toSessionSDP({
        "action": jingleElement.attr("action"),
        "initiator": jingleElement.attr("initiator"),
        responder,
        "sid": jingleElement.attr("sid"),
        // ---- Content payload
        "groups": groups,
        "contents": contents,
    }, { role, direction});
}