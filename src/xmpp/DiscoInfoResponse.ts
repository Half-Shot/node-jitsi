export class DiscoInfoResponse {
    constructor(private id: string, private to: string) {}
    public get xml() {
        return `
        <iq id="${this.id}" to="${this.to}" type="result" 
        xmlns="jabber:client">
        <query node="http://jitsi.org/jitsimeet#cvjWXufsg4xT62Ec2mlATkFZ9lk=" 
            xmlns="http://jabber.org/protocol/disco#info">
            <feature var="http://jabber.org/protocol/caps"/>
            <feature var="urn:ietf:rfc:4588"/>
            <feature var="urn:ietf:rfc:5761"/>
            <feature var="urn:ietf:rfc:5888"/>
            <feature var="urn:xmpp:jingle:1"/>
            <feature var="urn:xmpp:jingle:apps:dtls:0"/>
            <feature var="urn:xmpp:jingle:apps:rtp:1"/>
            <feature var="urn:xmpp:jingle:apps:rtp:audio"/>
            <feature var="urn:xmpp:jingle:apps:rtp:video"/>
            <feature var="urn:xmpp:jingle:transports:dtls-sctp:1"/>
            <feature var="urn:xmpp:jingle:transports:ice-udp:1"/>
            <feature var="urn:xmpp:rayo:client:1"/>
        </query>
        </iq>
        `;
    }
}