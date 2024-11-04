import { Encoder, decode } from 'cbor-x';
import { hexToUint8Array, printHex } from "../utils";
import { FIDOKeyHIDDevice } from "./FidoKeyHidDevice";

class CTAPHIDError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CTAPHIDError';
  }

}

export class CtapHid {
  private fidoKeyHidDevice: FIDOKeyHIDDevice;
  private cid: Uint8Array | null = null;

  private REPORT_ID = 0x00;

  private CTAP_FRAME_INIT = 0x80;
  private CTAPHID_INIT = this.CTAP_FRAME_INIT | 0x06;
  private CTAPHID_WINK = this.CTAP_FRAME_INIT | 0x08;
  private CTAPHID_CBOR = this.CTAP_FRAME_INIT | 0x10;

  private AUTHENTICATOR_GET_INFO = 0x04;
  private VENDOR_SPEC_BBS_COMMITMENT = 0x50;
  private VENDOR_SPEC_BBS_PROOF = 0x51;

  constructor(fidoKeyHidDevice: FIDOKeyHIDDevice) {
    this.fidoKeyHidDevice = fidoKeyHidDevice;
  }


  // https://fidoalliance.org/specs/fido-v2.0-id-20180227/fido-client-to-authenticator-protocol-v2.0-id-20180227.html#usb-hid-init
  async init() {
    const initCmd = new Uint8Array(64);
    initCmd.set([0xff, 0xff, 0xff, 0xff], 0);  // CID
    initCmd[4] = this.CTAPHID_INIT; // CMD
    initCmd.set([0x00, 0x08], 5);  // BCNT
    const nonce = new Uint8Array(8);
    crypto.getRandomValues(nonce);
    initCmd.set(nonce, 7);  // Nonce

    const responses = await this.sendReportAndWaitForResponse(this.REPORT_ID, initCmd);
    if (responses.length !== 1) {
      throw new CTAPHIDError('Invalid response length');
    }
    // TODO: nonceとの一致の確認

    printHex(initCmd);

    const response = responses[0];

    this.cid = response.slice(15, 19);
  }

  async wink() {
    if (!this.cid) {
      throw new CTAPHIDError('Not initialized');
    }
    const winkCmd = new Uint8Array(64);
    winkCmd.set(this.cid, 0);
    winkCmd[4] = this.CTAPHID_WINK;
    winkCmd.set([0x00, 0x00], 5);  // Length

    console.log(winkCmd);

    await this.sendReportAndWaitForResponse(this.REPORT_ID, winkCmd);
  }

  cbor(responses: Uint8Array[]) {
    const firstPacket = responses[0];
    // Error code (1 byte) is included in the first packet
    const cborSize = (firstPacket[5] << 8) | firstPacket[6] - 1;
    const cborData: Uint8Array = new Uint8Array(cborSize);

    let cursor = 0;
    for (const packet of responses) {
      let slicedPacket: Uint8Array;
      if (cursor === 0) {
        // Channel ID (4 bytes), CMD (1 byte), Length (2 bytes), Error code (1 byte)
        if (packet[7] !== 0) {
          throw new Error(`Error code in first packet: ${packet[7]}`);
        }
        slicedPacket = packet.slice(8);
      } else {
        // Channel ID (4 bytes), Sequence number (1 byte)
        slicedPacket = packet.slice(5);
      }
  
      const remainingSpace = cborSize - cursor;
      const bytesToCopy = Math.min(slicedPacket.length, remainingSpace);
      cborData.set(slicedPacket.slice(0, bytesToCopy), cursor);
      cursor += bytesToCopy;
  
      if (cursor >= cborSize) {
        break; 
      }
    }

    return {
      data: cborData,
      size: cborSize
    }
  }

  splitIntoPackets(data: Uint8Array, channelId: Uint8Array, cmd: number): Uint8Array[] {
    const PAYLOAD_SIZE_INITIALIZATION_PACKET = 64 - 7 - 1 // 64 - (Channel ID (4) + CMD (1) + Length (2)) - CMD(1)
    const PAYLOAD_SIZE_A_CONTINUATION_PACKET = 64 - 5 // 64 - (Channel ID (4) + SQC (1)

    const packets: Uint8Array[] = [];

    let sequenceNumber = 0;
  
    // initialization packet
    const firstPacket = new Uint8Array(64);
    firstPacket.set(channelId, 0); // Channel ID
    firstPacket[4] = this.CTAPHID_CBOR; 
    const lengthBytes = new Uint8Array(new Uint16Array([data.length + 1]).buffer);
    firstPacket[5] = lengthBytes[1];
    firstPacket[6] = lengthBytes[0];
    firstPacket[7] = cmd; // CMD
  
    const firstPayloadSize = Math.min(PAYLOAD_SIZE_INITIALIZATION_PACKET, data.length);
    firstPacket.set(data.slice(0, firstPayloadSize), 8);
    packets.push(firstPacket);
  
    // continuation packets
    let cursor = firstPayloadSize;
    while (cursor < data.length) {
      const remainingData = data.length - cursor;
      const payloadSize = Math.min(PAYLOAD_SIZE_A_CONTINUATION_PACKET, remainingData);
      const packet = new Uint8Array(64);
      
      packet.set(channelId, 0);
      packet[4] = sequenceNumber;
      packet.set(data.slice(cursor, cursor + payloadSize), 5);
      
      packets.push(packet);
      cursor += payloadSize;
      sequenceNumber += 1;
    }
  
    return packets;
  }
  

  async getInfo() {
    if (!this.cid) {
      throw new CTAPHIDError('Not initialized');
    }
    const getInfoCmd = new Uint8Array(64);
    getInfoCmd.set(this.cid, 0);
    getInfoCmd[4] = this.CTAPHID_CBOR;
    getInfoCmd.set([0x00, 0x01], 5);  // Length
    getInfoCmd[7] = this.AUTHENTICATOR_GET_INFO; 

    console.log(printHex(getInfoCmd));

    const responses = await this.sendReportAndWaitForResponse(this.REPORT_ID, getInfoCmd);

    const { data } = this.cbor(responses);
    const parsedData = decode(data);

    return parsedData;
  }

  async bbsCommitment() {
    if (!this.cid) {
      throw new CTAPHIDError('Not initialized');
    }
    const bbsCommitmentCmd = new Uint8Array(64);
    bbsCommitmentCmd.set(this.cid, 0);
    bbsCommitmentCmd[4] = this.CTAPHID_CBOR;
    bbsCommitmentCmd.set([0x00, 0x01], 5); 
    bbsCommitmentCmd[7] = this.VENDOR_SPEC_BBS_COMMITMENT; 

    console.log(printHex(bbsCommitmentCmd))

    const responses = await this.sendReportAndWaitForResponse(this.REPORT_ID, bbsCommitmentCmd, 10000);

    const { data } = this.cbor(responses);
    const parsedData = decode(data);

    return parsedData;
  }

  async bbsProof() {
    if (!this.cid) {
      throw new CTAPHIDError('Not initialized');
    }
    const PUBLIC_KEY = 0x01;
    const MESSAGES = 0x02;
    const SIGNATURE = 0x03;
    const HEADER = 0x04;
    const PRESENTATION_HEADER = 0x05;
    const DISCLOSED_INDEXES = 0x06;
    const SECRET_PROVER_BLIND = 0x07;

    const data = {
      "commitmentWithProof": "85f66cab421af2f338a8101278101c604e5989e0023e2959d37803b253db83e6af304e331d3c3a9a375fe61bb8471c1110c781ca653933829fa2edb34481fde4eec386adc73d055b9c0d2b976e463ab532b3e50732a60dd7c4f04fa124656e73111afea5557e457ec13b08568006c9eb565640d013b0f552e0fdbc69dfc98bfc172a3fecc9e561950a9ddffa9f4d01e9",
      "disclosedIndexes": [],
      "header": "",
      "linkSecret": "633bea5333057a76066dd395593a2bf1c2655455cba3717041908a74cde62dba",
      "messages": [],
      "outputDisclosedIndexes": [],
      "outputDisclosedMessages": [],
      "presentationHeader": "",
      "proof": "8d7dc08edeaed8d8a1550eae069205b1d9401fa4e7535c7ae961fc3e42d277413a9eae1ca4eff4a2e68ecdc42f0907e4b02a3fec5577c04985946913c17679ff66a9276f2dad63e74eae01e7d3c9305fba98d974ab5a387e43e1d1f2f1251701a7772931868d41dee5a6dcbaf4b8dfdf7d7b3dabf07def33d8e6d8be963c7a199072ee97868c4dc77144ee6d606e424906edadfb77d37dedf287a26ea92f2bcde5e9c80da8e8287782b76a89e73810e461249ea4c33397c847c34e6424fe7d5070d5f1aa57e80805e0908a46cbe9578a02cf3738c554559924c90b0d00594fcedff0f20d8d613d9a762e6fa745a37cbd2f52bc9db6620e0127a121593f58e7c3698876d8f157852e6b3d76342ee4df0a2ac9ed69f70a241eb60438fe97969459d90b1e978382a6ba9474a9248d03a38665461cdc2a06059214934dcdc098c05a4a6d76a994eec382edbefb57a1e6c34e",
      "proverBlindFactor": "1c3b148d8fdf60797e12aa4b3bd7168b12e513d6433eea18dbc856d9fc5ff04a",
      "signature": "b3794b4a514965005b3798c5c596e37d52f96f8fee6bf196be7639f3ff4c5e64027d1f7b3905bb0f12688e4b9af45a0a4e21136feefdb98fb93a0b66cfd4320ffd9fc4d9984ac36596db826cd07774d8",
      "signerKeyPair": {
        "publicKey": "92d37d1d6cd38fea3a873953333eab23a4c0377e3e049974eb62bd45949cdeb18fb0490edcd4429adff56e65cbce42cf188b31bddbd619e419b99c2c41b38179eb001963bc3decaae0d9f702c7a8c004f207f46c734a5eae2e8e82833f3e7ea5",
        "secretKey": "2eee0f60a8a3a8bec0ee942bfd46cbdae9a0738ee68f5a64e7238311cf09a079"
      }
    }

    // const data = {
    //   "commitmentWithProof": "85f66cab421af2f338a8101278101c604e5989e0023e2959d37803b253db83e6af304e331d3c3a9a375fe61bb8471c1110c781ca653933829fa2edb34481fde4eec386adc73d055b9c0d2b976e463ab532b3e50732a60dd7c4f04fa124656e73111afea5557e457ec13b08568006c9eb565640d013b0f552e0fdbc69dfc98bfc172a3fecc9e561950a9ddffa9f4d01e9",
    //   "disclosedIndexes": [0, 2, 4],
    //   "header": "",
    //   "messages": [
    //     "message1",
    //     "message2",
    //     "message3",
    //     "message4",
    //     "message5"
    //   ],
    //   "presentationHeader": "",
    //   "proverBlindFactor": "13413e62b8460e2480f4a107310b9e549207a69c8e0fa539283bd0ab0f6c7d05",
    //   "signature": "ae34b6daabd21cff415fd08422eb0095cdc12dfe1c678a50e6d5e18a68b08b88d1b4568a8960783136c05e52681e7c5f658d3cccec69cdd35472b1d624ef9fada5335b7839b4d7e26e1766799af9c120",
    //   "signerKeyPair": {
    //     "publicKey": "92d37d1d6cd38fea3a873953333eab23a4c0377e3e049974eb62bd45949cdeb18fb0490edcd4429adff56e65cbce42cf188b31bddbd619e419b99c2c41b38179eb001963bc3decaae0d9f702c7a8c004f207f46c734a5eae2e8e82833f3e7ea5",
    //   }
    // };
    

    const public_key = hexToUint8Array(data.signerKeyPair.publicKey);
    const signature = hexToUint8Array(data.signature);
    const secret_prover_blind = hexToUint8Array(data.proverBlindFactor);
    const header = hexToUint8Array(data.header);
    const presentation_header = hexToUint8Array(data.presentationHeader);
    const disclosed_indexes = data.disclosedIndexes;
    const messages = data.messages.map(message => new TextEncoder().encode(message));

    const cborMap = new Map<number, any>([
      [PUBLIC_KEY, public_key],
      [MESSAGES, messages],
      [SIGNATURE, signature],
      [HEADER, header],
      [PRESENTATION_HEADER, presentation_header],
      [DISCLOSED_INDEXES, disclosed_indexes],
      [SECRET_PROVER_BLIND, secret_prover_blind]
    ]);
    
    const encoder = new Encoder({
      mapsAsObjects: true,
      tagUint8Array: false,
      useRecords: false,   
      variableMapSize: true,
      // useTag259ForMaps: false,
    });

    console.log(cborMap)
    const cborData = encoder.encode(cborMap);

    printHex(cborData);

    const packets = this.splitIntoPackets(cborData, this.cid, this.VENDOR_SPEC_BBS_PROOF);
    console.log(packets)

    await this.fidoKeyHidDevice.device.sendReport(this.REPORT_ID, packets[0]);
    await this.fidoKeyHidDevice.device.sendReport(this.REPORT_ID, packets[1]);
    await this.fidoKeyHidDevice.device.sendReport(this.REPORT_ID, packets[2]);
    const responses = await this.sendReportAndWaitForResponse(this.REPORT_ID, packets[3], 20000);

    const { data: resCborData } = this.cbor(responses);
    const parsedData = decode(resCborData);
    return parsedData;
  }

  /**
   * Sends a report to the HID device and waits for a response.
   * 
   * This function handles the complexities of communicating with HID devices,
   * including multi-packet responses and varying timeout requirements.
   * 
   * Behavior:
   * - Waits up to 'initialTimeout' for the first response packet.
   * - After receiving the first packet, waits up to 1000ms for each subsequent packet.
   * - If no new packet is received within 1000ms after the last one, considers the response complete.
   * - If no packets are received before the initial timeout, throws a timeout error.
   * - If at least one packet is received, returns all received packets, even if later timeouts occur.
   */
  private async sendReportAndWaitForResponse(reportId: number, data: Uint8Array, initialTimeout = 5000): Promise<Uint8Array[]> {
    return new Promise((resolve, reject) => {
      const responses: Uint8Array[] = [];
      let timer: number;
      let isFirstPacket = true;
  
      const setTimer = (timeout: number) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          cleanup();
          if (responses.length > 0) {
            resolve(responses);
          } else {
            reject(new CTAPHIDError('Response timeout'));
          }
        }, timeout);
      };
  
      const onInputReport = (event: HIDInputReportEvent) => {
        const response = new Uint8Array(event.data.buffer);
        responses.push(response);
  
        if (isFirstPacket) {
          isFirstPacket = false;
          setTimer(1000); 
        } else {
          setTimer(1000); 
        }
      };
  
      const cleanup = () => {
        clearTimeout(timer);
        this.fidoKeyHidDevice.device.removeEventListener('inputreport', onInputReport as EventListener);
      };
  
      this.fidoKeyHidDevice.device.addEventListener('inputreport', onInputReport as EventListener);
      setTimer(initialTimeout); 
  
      this.fidoKeyHidDevice.device.sendReport(reportId, data).catch(error => {
        cleanup();
        reject(new CTAPHIDError(`Failed to send report: ${error.message}`));
      });
    });
  }
}