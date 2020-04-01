import { Element } from "@xmpp/xml";
import { toSessionSDP } from 'sdp-jingle-json';
export function Jingle2SDP(jingleElement: Element, responder: string, direction: string) {
    const s: any = jingleElement.toJSON();
    console.log(s);

    const groups = s.children.group.children.map((e) => ({
        semantics: e.attrs.semantics,
        contents: e.children.map((e) => e.attrs.name)
    }));

    console.log(groups);

    const contents = jingleElement.getChildren("content").map((e) => {
        const application = {

        }
        const transport = {

        }
        return {
            name: e.getAttr("name"),
            creator: e.getAttr("creator"),
            senders: e.getAttr("senders"),
            application,
            tranports: []
        }
    });

    return toSessionSDP({
        "action": jingleElement.attr("action"),
        "initiator": jingleElement.attr("initiator"),
        responder,
        "sid": jingleElement.attr("sid"),
        // ---- Content payload
        "groups": groups,
        "contents": contents
            // {
            //    "name": "",
            //    "creator": "",
            //    "senders": "",
            //    "application": {
            //        // ---- RTP description
            //        "applicationType": "rtp",
            //        "media": "",
            //        "ssrc": "",
            //        "sourceGroups": [
            //             {
            //                 "semantics": "",
            //                 "sources": [
            //                     "" //...
            //                 ]
            //             } //...
            //        ],
            //        "sources": [
            //            {
            //                "ssrc": "",
            //                "parameters": [
            //                    {
            //                        "key": "",
            //                        "value": ""
            //                    } //...
            //                ]
            //            } //...
            //        ],
            //        "bandwidth": "",
            //        "bandwidthType": "",
            //        "headerExtensions": [
            //            {
            //                "id": "",
            //                "uri": "",
            //                "senders": ""
            //            } //...
            //        ],
            //        "payloads": [
            //            {
            //                "id": "",
            //                "channels": "",
            //                "clockrate": "",
            //                "maxptime": "",
            //                "ptime": "",
            //                "name": "",
            //                "parameters": [
            //                    {
            //                        "key": "",
            //                        "value": ""
            //                    } //...
            //                ],
            //                "feedback": [
            //                    {
            //                        "type": "",
            //                        "subtype": "",
            //                        "value": ""
            //                    } //...
            //                ]
            //            }
            //         ],
            //         "encryption": [
            //             {
            //                 "cipherSuite": "",
            //                 "keyParams": "",
            //                 "sessionParams": "",
            //                 "tag": ""
            //             } //...
            //         ]
            //    },
        //        "transport": {
        //            // ---- ICE UDP transport
        //            "transportType": "iceUdp",
        //            "ufrag": "",
        //            "pwd": "",
        //            "setup": "",
        //            "candidates": [
        //                {
        //                    "component": "",
        //                    "foundation": "",
        //                    "generation": "",
        //                    "id": "",
        //                    "ip": "",
        //                    "network": "",
        //                    "port": "",
        //                    "priority": "",
        //                    "protocol": "",
        //                    "relAddr": "",
        //                    "relPort": "",
        //                    "type": ""
        //                } //...
        //            ],
        //            "fingerprints": [
        //                {
        //                "hash": "",
        //                "value": ""
        //                } // ...
        //            ]
        //        }
        //     } //...
        // ]
    });
}