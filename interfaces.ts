export interface ParsedLog {
    name: string;
    signature: string;
    args: Record<string, any>;
    address: string;
    topics: string[];
    data: string;
    blockNumber: number;
    transactionHash: string;
    logIndex: number;
}

export interface RawLog {
    parsed: boolean;
    error: string;
    raw: {
        address: string;
        topics: string[];
        data: string;
        blockNumber: number;
        transactionHash: string;
        logIndex: number;
    };
}

export interface ProofResponse {
    proof: {
        merkle_proof: string[];
        rollup_merkle_proof: string[];
        main_exit_root: string;
        rollup_exit_root: string;
    }
}
