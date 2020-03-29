import { Parser } from "@xmpp/xml";

export class BoshParser extends Parser {
    // Need emitters for:
    // error
    // element
    // end
    // start
    constructor() {
        super();
    }

    write(xmlStr: string) {
        super.write(xmlStr);
    }
}