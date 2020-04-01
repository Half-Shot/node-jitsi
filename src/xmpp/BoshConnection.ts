// /**
//  * BOSH Connection client for xmpp.js
//  */

// import { EventEmitter } from "events";
// import Axios, { AxiosInstance } from "axios";
// import { BoshSessionData, BoshSessionCreationRequest } from "./BoshSessionData";

// export class BoshConnection extends EventEmitter {
//     private rid?: number;
//     private httpClient: AxiosInstance;
//     constructor(private domain: string, boshUrl: string) {
//         super();
//         this.httpClient = Axios.create({
//             baseURL: boshUrl,
//             timeout: 60000,
//             headers: {

//             },
//         });
//         console.log("Created BoshConnection");
//     }

//     async connect(baseURL) {
//         // This is the stream creation stanza.
//         // Set an RID and write our own request
//         this.rid = Date.now();
//         await this.writeSessionData(
//             new BoshSessionCreationRequest(
//                 'jitsi.modular.im',
//                 this.rid.toString(),
//             )
//         );
//     }

//     write(data: string, cb: (error?: Error) => void) {
//         // XXX: Due to xmpp.js's requirements, this must return a cb.
//         // XXX: Horrible detection of stream creation
//         console.log(`PEND-TX: ${data}`);
//         let promise: Promise<string|null>;
//         if (!this.rid) {
//             // This is the stream creation stanza.
//             // Set an RID and write our own request
//             this.rid = Date.now();
//             promise = this.writeSessionData(new BoshSessionCreationRequest('jitsi.modular.im', this.rid.toString()));
//         } else {
//             promise = Promise.resolve(null);
//         }
//         this.rid++;
//         promise.then((data) => {
//             cb();
//             return data;
//         }).then((data) => {
//             if (data) {
//                 this.emit("data", data);
//             }
//         }).catch(cb);
//     }
    
//     private async writeSessionData(writeData: BoshSessionData): Promise<string> {
//         try {
//             const xmlData = writeData.toXML();
//             console.log("TX:", xmlData);
//             const { data } = await this.httpClient.post("",xmlData, {
//                 headers: {
//                     "Content-Type": "text/xml; charset=utf",
//                 }
//             });
//             console.log("RX:", data);
//             return data;
//         } catch (ex) {
//             console.log("ERROR REQ:", ex);
//             throw ex;
//         }
//     }
// }