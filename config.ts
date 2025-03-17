const { ethers } = require("ethers");

const dotenv = require("dotenv");

const PolygonZKEVMBridgeV2ABI = require("./PolygonZKEVMBridgeV2ABI.json");

dotenv.config();

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("PRIVATE_KEY is not defined in environment variables");
}

const sepoliaPolygonZKEVMBridgeV2Address = "0x528e26b25a34a4A5d0dbDa1d57D318153d2ED582";
const sepoliaRPC = "https://1rpc.io/sepolia";
const sepoliaProvider = new ethers.JsonRpcProvider(sepoliaRPC);
const sepoliaSigner = new ethers.Wallet(privateKey, sepoliaProvider);

const cardonaPolygonZKEVMBridgeV2Address = "0x528e26b25a34a4A5d0dbDa1d57D318153d2ED582";
const cardonaRPC = "https://rpc.cardona.zkevm-rpc.com";
const cardonaProvider = new ethers.JsonRpcProvider(cardonaRPC);
const cardonaSigner = new ethers.Wallet(privateKey, cardonaProvider);

module.exports = {
    PolygonZKEVMBridgeABI: PolygonZKEVMBridgeV2ABI,

    sepoliaPolygonZKEVMBridgeV2Address: "0x528e26b25a34a4A5d0dbDa1d57D318153d2ED582",
    sepoliaNetworkId: 0,
    sepoliaRPC: "https://1rpc.io/sepolia",
    sepoliaProvider: new ethers.JsonRpcProvider(sepoliaRPC),
    sepoliaSigner: new ethers.Wallet(privateKey, sepoliaProvider),
    sepoliaContract: new ethers.Contract(sepoliaPolygonZKEVMBridgeV2Address, PolygonZKEVMBridgeV2ABI, sepoliaSigner),

    cardonaPolygonZKEVMBridgeV2Address: "0x528e26b25a34a4A5d0dbDa1d57D318153d2ED582",
    cardonaNetworkId: 1,
    cardonaRPC: "https://rpc.cardona.zkevm-rpc.com",
    cardonaProvider: new ethers.JsonRpcProvider(cardonaRPC),
    cardonaSigner: new ethers.Wallet(privateKey, cardonaProvider),
    cardonaContract: new ethers.Contract(cardonaPolygonZKEVMBridgeV2Address, PolygonZKEVMBridgeV2ABI, cardonaSigner),
}
