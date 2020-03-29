export interface BoshSessionData {
    toXML(): string;
}

export class BoshSessionCreationRequest implements BoshSessionData {
    constructor(private to: string, private rid: string) {

    }

    toXML(): string {
        return "<body content='text/xml; charset=utf-8'"
        + " xml:lang='en'"
        + " xmpp:version='1.0'"
        + " wait='60'"
        + " hold='1'"
        + " ver='1.6'"
        + " xmlns='http://jabber.org/protocol/httpbind'"
        + " xmlns:xmpp='urn:xmpp:xbosh'"
        + ` rid='${this.rid}'`
        + ` to='${this.to}'/>`;
    }
}