import { Parser } from "@xmpp/xml";
import { Jingle2SDP } from "../src/JingleSDP";

import { readFile } from "fs";

const parser = new Parser();
parser.on("element", (e) => {
    if (e.is("jingle")) {
        const res = Jingle2SDP(e, "ressp", "responder", "incoming");
        console.log(res);
    }
})

readFile('examples/session-initiate.xml', (err, data) => {
    console.log(err);
    parser.write(data);
});