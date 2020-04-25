export interface JitsiUserPresence {
    videoMuted: boolean,
    audioMuted: boolean,
    avatarId?: string,
    email: string,
    nick: string,
    handRaised: boolean,
}

export class JitsiPresence {
    constructor(private roomName: string, private conferenceServer: string, private identity: string, private state: JitsiUserPresence, private isJoin: boolean) {}
    public get xml() {
        const mucJoin = this.isJoin ? '<x xmlns="http://jabber.org/protocol/muc"/>\n': "";
        const handRaised = this.state.handRaised ? "<jitsi_participant_raisedHand/>\n" : "";
        return `<presence to="${this.roomName}@${this.conferenceServer}/${this.identity}" xmlns="jabber:client">
            ${mucJoin}${handRaised}<nick xmlns="http://jabber.org/protocol/nick">${this.state.nick}</nick>
            <email>${this.state.email}</email>
            <videomuted xmlns="http://jitsi.org/jitmeet/video">${this.state.videoMuted}</videomuted>
            <audiomuted xmlns="http://jitsi.org/jitmeet/audio">${this.state.audioMuted}</audiomuted>
        </presence>`;
    }
} 