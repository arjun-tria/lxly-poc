const { ethers } = require("ethers");
const {
    sepoliaContract,
    cardonaNetworkId,
    PolygonZKEVMBridgeABI,
    cardonaContract,
    sepoliaNetworkId
} = require("./config");
const { ParsedLog, RawLog, ProofResponse } = require("./interfaces");

const userAddress = "0x7934d5340b1FA4e3d8f5Cd62705FEEE3EcE50eA3";
const amount = ethers.parseEther("0.00001");
const tokenAddress = "0x0000000000000000000000000000000000000000";

async function main() {
    const depositCount = await bridgeAsset();

    const claimCount = await claimAsset(depositCount);
    console.log("Claim Count: ", claimCount);

    return claimCount;
}

async function bridgeAsset() {
    try {
        const tx = await sepoliaContract.bridgeAsset(cardonaNetworkId, userAddress, amount, tokenAddress, true, "0x", {
            value: amount,
        });
        console.log("BridgeAsset Tx: ", tx);

        const receipt = await tx.wait();
        console.log("BridgeAsset Receipt: ", receipt);

        const depositCount = await extractBridgeEvents(receipt);
        console.log("Deposit Count: ", depositCount);

        return depositCount;
    } catch (error) {
        console.error("Error bridging asset: ", error);
        throw error;
    }
}

async function claimAsset(depositCount: number) {
    try {

        const proofs = await getProofs(sepoliaNetworkId, depositCount);

        const globalIndex = generateGlobalIndex(false, cardonaNetworkId, depositCount);

        const tx = await cardonaContract.claimAsset(
            proofs.merkelProof,
            proofs.rollupMerkleProof,
            globalIndex,
            proofs.mainExitRoot,
            proofs.rollupExitRoot,
            sepoliaNetworkId,
            tokenAddress,
            cardonaNetworkId,
            userAddress,
            amount,
            "0x",
        );
        console.log("ClaimAsset Tx: ", tx);

        const receipt = await tx.wait();
        console.log("ClaimAsset Receipt: ", receipt);

        return receipt;
    } catch (error: any) {
        console.error("Error claiming asset: ", error);

        if (error.data) {
            const AbiCoder = new ethers.AbiCoder();
            const reason = AbiCoder.decode(["string"], "0x" + error.data.slice(10));
            const message = reason[0];
    
            return {
              success: false,
              message,
              error: error,
            };
          }

        throw error;
    }
}

async function getLogs(receipt: any) {
    const parsedLogs: (typeof ParsedLog | typeof RawLog)[] = [];
    const contractInterface = new ethers.Interface(PolygonZKEVMBridgeABI);

    for (const log of receipt.logs) {
        try {
            // Try to parse the log with the provided ABI
            const parsedLog = contractInterface.parseLog({
                topics: log.topics,
                data: log.data
            });

            if (parsedLog) {
                // Convert BigInt values to strings to make them JSON-serializable
                const args: Record<string, any> = {};
                for (const [key, value] of Object.entries(parsedLog.args)) {
                    args[key] = typeof value === 'bigint' ? value.toString() : value;
                }

                parsedLogs.push({
                    name: parsedLog.name,
                    signature: parsedLog.signature,
                    args: args,
                    address: log.address,
                    topics: log.topics,
                    data: log.data,
                    blockNumber: log.blockNumber,
                    transactionHash: log.transactionHash,
                    logIndex: log.logIndex
                });
            }
        } catch (error) {
            // If parsing fails, include the raw log
            parsedLogs.push({
                parsed: false,
                error: 'Could not parse log with provided ABI',
                raw: {
                    address: log.address,
                    topics: log.topics,
                    data: log.data,
                    blockNumber: log.blockNumber,
                    transactionHash: log.transactionHash,
                    logIndex: log.logIndex
                }
            });
        }
    }

    return parsedLogs;
}

async function extractBridgeEvents(receipt: any): Promise<number> {
    const logs = await getLogs(receipt);
    const filteredLogs = logs
        .filter((log): log is typeof ParsedLog => 'name' in log && log.name === 'BridgeEvent')
        .map(log => ({
            leafType: Number(log.args[0]),
            originNetwork: Number(log.args[1]),
            originAddress: log.args[2],
            destinationNetwork: Number(log.args[3]),
            destinationAddress: log.args[4],
            amount: log.args[5],
            metadata: log.args[6],
            depositCount: Number(log.args[7])
        }));

    return filteredLogs[0].depositCount;
}

async function getProofs(networkId: number, depositCount: number) {
    const response = await fetch(`https://api-gateway.polygon.technology/api/v3/proof/testnet/merkle-proof?networkId=${networkId}&depositCount=${depositCount}`);

    const data = await response.json() as typeof ProofResponse;

    return {
        merkelProof: data.proof.merkle_proof,
        rollupMerkleProof: data.proof.rollup_merkle_proof,
        mainExitRoot: data.proof.main_exit_root,
        rollupExitRoot: data.proof.rollup_exit_root,
    }
}

function generateGlobalIndex(isMainnet: boolean, rollupIndex = 0, localRootIndex: number): bigint {
    // Start with BigInt 0
    let globalIndex = BigInt(0);

    // Set mainnet flag (1 bit at position 64)
    // 191 unused bits + 1 mainnet flag + 32 rollup bits + 32 local root bits = 256 bits
    // The mainnet flag is at bit position 64 (from the right)
    if (isMainnet) {
        globalIndex |= BigInt(1) << BigInt(64);
    }

    // Set rollup index (32 bits at position 32)
    // Only used when mainnet flag is 0
    if (!isMainnet) {
        globalIndex |= BigInt(rollupIndex) << BigInt(32);
    }

    // Set local root index (32 bits at position 0)
    globalIndex |= BigInt(localRootIndex);

    // Convert to hex string, remove '0x' prefix, pad to 64 characters, and add '0x' back
    return globalIndex;
}

main();

// Add this line to make the file a module
export {};
