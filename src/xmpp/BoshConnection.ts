/**
 * BOSH Connection client for xmpp.js
 */

import { EventEmitter } from "events";
import Connection from "@xmpp/connection";
import Axios, { AxiosInstance } from "axios";
import { BoshSessionData, BoshSessionCreationRequest } from "./BoshSessionData";
import { BoshParser } from "./BoshParser";

class BoshSocket extends EventEmitter {
    private rid?: number;
    private httpClient!: AxiosInstance;

    constructor() {
        super();
        console.log(`BoshSocket`, arguments);
        this.on("element", (e) => {
            console.log("Woo", e);
        });
    }

    async connect(baseURL) {
        this.httpClient = Axios.create({
            baseURL,
            timeout: 60000,
            headers: {

            },
        });
        setTimeout(() => this.emit("connect"), 500);
        // TODO: Actually connect.
        console.log(`BoshSocket.connect`, arguments);
    }

    write(data: string, cb: (error?: Error) => void) {
        // XXX: Due to xmpp.js's requirements, this must return a cb.
        // XXX: Horrible detection of stream creation
        console.log(`PEND-TX: ${data}`);
        let promise: Promise<string|null>;
        if (!this.rid) {
            // This is the stream creation stanza.
            // Set an RID and write our own request
            this.rid = Date.now();
            promise = this.writeSessionData(new BoshSessionCreationRequest('jitsi.modular.im', this.rid.toString()));
        } else {
            promise = Promise.resolve(null);
        }
        this.rid++;
        promise.then((data) => {
            cb();
            return data;
        }).then((data) => {
            if (data) {
                this.emit("data", data);
            }
        }).catch(cb);
    }
    
    private async writeSessionData(writeData: BoshSessionData) {
        try {
            const xmlData = writeData.toXML();
            console.log("TX:", xmlData);
            const { data } = await this.httpClient.post("",xmlData, {
                headers: {
                    "Content-Type": "text/xml; charset=utf",
                }
            });
            console.log("RX:", data);
            return data;
        } catch (ex) {
            console.log("ERROR REQ:", ex);
            throw ex;
        }
    }
}

export class BoshConnection extends Connection {
    constructor(options: any) {
        super(options);
        console.log("Created BoshConnection");
    }

    socketParameters(service: string) {
      console.log("service:", service);
      return service.match(/^https?:\/\//) ? service : undefined;
    }

    get Socket() {
        return BoshSocket;
    }

    get NS() {
        return "jabber:client";
    }

    get Parser() {
        return BoshParser;
    }

    connect() {
        console.log("BoshConnection.connect:", arguments);
    }

    static applyToClient(client: any) {
        client.transports.push(BoshConnection)
    }
}