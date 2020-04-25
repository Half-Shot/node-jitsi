// Type definitions for [~THE LIBRARY NAME~] [~OPTIONAL VERSION NUMBER~]
// Project: [~THE PROJECT NAME~]
// Definitions by: [~YOUR NAME~] <[~A URL FOR YOU~]>

/*~ This is the module template file. You should rename it to index.d.ts
 *~ and place it in a folder with the same name as the module.
 *~ For example, if you were writing a file for "super-greeter", this
 *~ file should be 'super-greeter/index.d.ts'
 */

/*~ If this module has methods, declare them as functions like so.
 */

interface SdpJson {

}

export function toSessionSDP(sdpContent: SdpJson): string;
export function toSessionJSON(sdp: string, opts: { role: string, direction: string, creators: string[]}): SdpJson;
