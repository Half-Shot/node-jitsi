export class JitsiJoinConference {
    constructor(private roomName: string, private conferenceServer: string, private identity: string, private nick: string, private audioMuted: boolean = true, private videoMuted: boolean = true) {}
    public get xml() {
        return `<presence to="${this.roomName}@${this.conferenceServer}/${this.identity}" xmlns="jabber:client">
            <x xmlns="http://jabber.org/protocol/muc"/>
            <videomuted xmlns="http://jitsi.org/jitmeet/video">${this.videoMuted}</videomuted>
            <nick xmlns="http://jabber.org/protocol/nick">${this.nick}</nick>
            <audiomuted xmlns="http://jitsi.org/jitmeet/audio">${this.audioMuted}</audiomuted>
        </presence>`
        //             <c hash="sha-1" node="http://jitsi.org/jitsimeet" ver="cvjWXufsg4xT62Ec2mlATkFZ9lk=" xmlns="http://jabber.org/protocol/caps"/>
        //             <email>${this.email}</email>
        //             <avatar-id>d901ccb885d86a24c94295f0c5b2c995</avatar-id>
    }
} 