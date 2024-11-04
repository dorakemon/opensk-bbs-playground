import { useState } from 'react';
import { CtapHid } from './ctap/CtapHid';
import { FIDOKeyHIDDevice } from './ctap/FidoKeyHidDevice';
import { OPENSK_DEVICE_ID, OPENSK_PRODUCT_ID } from './ctap/constants';
import { printHex } from './utils';

const useDeviceConnection = () => {
  const [device, setDevice] = useState<FIDOKeyHIDDevice | null>(null);
  const connectHandler = async () => {
    const devices = 
      await FIDOKeyHIDDevice.listDevices(OPENSK_DEVICE_ID, OPENSK_PRODUCT_ID);
    if (devices.length === 0) {
      console.error('No device found');
      return;
    }
    const _device = devices[0];
    const fidoKeyHIDDevice = new FIDOKeyHIDDevice(_device);
    await fidoKeyHIDDevice.open();
    console.log("Device info:", fidoKeyHIDDevice.deviceInfo);
    setDevice(fidoKeyHIDDevice);
  }
  return { connectHandler, fidoKeyHIDDevice: device };
}

const App = () => {
  const [_isExpanded, _setIsExpanded] = useState(false);

  const [_deviceInfo, _setDeviceInfo] = useState<string | null>(null);
  const [bbsCommitment, setBbsCommitment] = useState<string | null>(null);
  const [bbsCommitmentBlindFactor, setBbsCommitmentBlindFactor] = useState<string | null>(null);
  const [bbsProof, setBbsProof] = useState<string | null>(null);

  const { connectHandler, fidoKeyHIDDevice } = useDeviceConnection();

  // const _winkHandler = async () => {
  //     if (!fidoKeyHIDDevice) {
  //       console.error('Device is not connected');
  //       return;
  //     }
  //     const ctapHid = new CtapHid(fidoKeyHIDDevice);
  //     await ctapHid.init();

  //     await ctapHid.wink();
  // }

  const bbsCommitmentHandler = async () => {
    try {
      if (!fidoKeyHIDDevice) {
        console.error('Device is not connected');
        return;
      }
      const ctapHid = new CtapHid(fidoKeyHIDDevice);
      await ctapHid.init();

      const bbsCommitment = await ctapHid.bbsCommitment();
      const blindFactor = bbsCommitment["1"]
      const commitment = bbsCommitment["2"]

      console.log(commitment)
      console.log(blindFactor)

      // setBbsCommitment(JSON.stringify({
      //   "commitment": printHex(commitment),
      //   "blindFactor": printHex(blindFactor)
      // }, null, 2));
      setBbsCommitment(printHex(commitment))
      setBbsCommitmentBlindFactor(printHex(blindFactor))
    } catch (error) {
      console.error("Error:", error);
    }
  }

  // const _getInfo = async () => {
  //   if (!fidoKeyHIDDevice) {
  //     console.error('Device is not connected');
  //     return;
  //   }
  //   const ctapHid = new CtapHid(fidoKeyHIDDevice);
  //   await ctapHid.init();

  //   const info = await ctapHid.getInfo();
  //   setDeviceInfo(JSON.stringify(info, null, 2));
  // }

  const bbsProofHandler = async () => {
    try {
      if (!fidoKeyHIDDevice) {
        console.error('Device is not connected');
        return;
      }
      const ctapHid = new CtapHid(fidoKeyHIDDevice);
      await ctapHid.init();

      const _bbsProof = await ctapHid.bbsProof();
      console.log(_bbsProof)
      setBbsProof(printHex(_bbsProof["1"]))
    } catch (error) {
      console.error("Error:", error);
    }
  }

  // const _toggleExpand = () => {
  //   setIsExpanded(!isExpanded);
  // };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'left', gap: '20px', margin: "40px" }}>
      <h1>BBS on USB Key Demo</h1>
      <button onClick={connectHandler} style={{width: "120px"}}>Connect</button>
      {/* <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <label>Wink</label>
        <button onClick={winkHandler} style={{width: "90px"}}>Wink</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <label>Device Info</label>
        <button onClick={getInfo} style={{width: "120px"}}>Get Info</button>
        <textarea style={{ width: "100%", height: '100px', marginTop: '10px' }} value={deviceInfo || ''} readOnly />
      </div> */}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <label>BBS Commitment</label>
        <button onClick={bbsCommitmentHandler} style={{width: "120px"}}>BBS Commitment</button>
        <div>
          <label>Commitment</label>
          <textarea style={{ width: "100%", height: '60px' }} value={bbsCommitment || ''} readOnly />
          <label>Blind Factor</label>
          <textarea style={{ width: "100%", height: '20px' }} value={bbsCommitmentBlindFactor || ''} readOnly />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <label>BBS Proof</label>
        <button style={{width: "120px"}} onClick={bbsProofHandler}>BBS Proof</button>
        <textarea style={{ width: "100%", height: '100px', marginTop: '10px' }} value={bbsProof || ''} readOnly />
      </div>
    </div>
  )
}

export default App
