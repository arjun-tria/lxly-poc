"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
const generated_1 = require("generated");
// import { getTokenMetadata, getTokenPriceUSD, calculateUSDValue } from "./utils/tokenPrice";
// import { postgresWriter } from "./db/postgres-writer";
generated_1.TransparentUpgradeableProxy.ContractConfigured.handler(async ({ event, context }) => {
    // Logic removed to unnecessary DB writes
});
generated_1.TransparentUpgradeableProxy.Deposit.handler(async ({ event, context }) => {
    const timestamp = BigInt(event.block.timestamp);
    const vaultAddress = event.srcAddress.toLowerCase();
    const userAddress = event.params.receiverAddr.toLowerCase();
    const vaultId = `${event.chainId}_${vaultAddress}`;
    const userId = userAddress;
    const userVaultPositionId = `${userId}_${vaultId}`;
    // Raw entity creation removed
    // Get or create Vault
    let vault = await context.Vault.get(vaultId);
    // Fetch token metadata and price if vault is new or price is missing
    let tokenDecimals = vault?.tokenDecimals || BigInt(18); // Default to 18
    let tokenSymbol = vault?.tokenSymbol || undefined;
    let tokenPriceUSD = vault?.tokenPriceUSD || "0";
    if (!vault || !vault.tokenPriceUSD || vault.tokenPriceUSD === "0") {
        // Fetch token metadata and price using Effect API
        const metadata = await context.effect(getTokenMetadata, {
            tokenAddress: event.params.assetIn,
            chainId: event.chainId,
        });
        if (metadata) {
            try {
                const metadataObj = JSON.parse(metadata);
                tokenDecimals = BigInt(metadataObj.decimals);
                tokenSymbol = metadataObj.symbol;
            }
            catch (e) {
                console.error("Error parsing token metadata:", e);
            }
        }
        const price = await context.effect(getTokenPriceUSD, {
            tokenAddress: event.params.assetIn,
            chainId: event.chainId,
        });
        if (price) {
            tokenPriceUSD = price;
        }
    }
    else {
        tokenDecimals = vault.tokenDecimals;
        tokenSymbol = vault.tokenSymbol || undefined;
        tokenPriceUSD = vault.tokenPriceUSD;
    }
    // Calculate new values
    const newTVL = vault ? vault.tvl + event.params.amountIn : event.params.amountIn;
    const newTotalDeposits = vault ? vault.totalDeposits + event.params.amountIn : event.params.amountIn;
    // Calculate USD values
    const tvlUSD = calculateUSDValue(newTVL, Number(tokenDecimals), tokenPriceUSD);
    const totalDepositsUSD = calculateUSDValue(newTotalDeposits, Number(tokenDecimals), tokenPriceUSD);
    const totalWithdrawalsUSD = vault
        ? calculateUSDValue(vault.totalWithdrawals, Number(tokenDecimals), tokenPriceUSD)
        : "0.00";
    const totalManagementFeesUSD = vault
        ? calculateUSDValue(vault.totalManagementFees, Number(tokenDecimals), tokenPriceUSD)
        : "0.00";
    const vaultUpdated = vault
        ? {
            ...vault,
            tvl: newTVL,
            tvlUSD: tvlUSD,
            totalDeposits: newTotalDeposits,
            totalDepositsUSD: totalDepositsUSD,
            totalWithdrawalsUSD: totalWithdrawalsUSD,
            totalManagementFeesUSD: totalManagementFeesUSD,
            tokenDecimals: tokenDecimals,
            tokenPriceUSD: tokenPriceUSD,
            tokenSymbol: tokenSymbol,
            updatedAt: timestamp,
        }
        : {
            id: vaultId,
            address: vaultAddress,
            chainId: BigInt(event.chainId),
            assetAddress: event.params.assetIn,
            tvl: newTVL,
            tvlUSD: tvlUSD,
            totalDeposits: newTotalDeposits,
            totalDepositsUSD: totalDepositsUSD,
            totalWithdrawals: BigInt(0),
            totalWithdrawalsUSD: "0.00",
            totalManagementFees: BigInt(0),
            totalManagementFeesUSD: "0.00",
            tokenDecimals: tokenDecimals,
            tokenPriceUSD: tokenPriceUSD,
            tokenSymbol: tokenSymbol,
            isDepositsPaused: false,
            isWithdrawalsPaused: false,
            createdAt: timestamp,
            updatedAt: timestamp,
        };
    context.Vault.set(vaultUpdated);
    // Write to Postgres
    // try {
    //   await postgresWriter.setVault({
    //     ...vaultUpdated,
    //     tokenSymbol: vaultUpdated.tokenSymbol ?? null
    //   });
    // } catch (error) {
    //   console.error("Failed to write Vault to Postgres:", error);
    // }
    // Get or create User
    let user = await context.User.get(userId);
    const userUpdated = user
        ? {
            ...user,
            totalDepositsAcrossAllVaults: user.totalDepositsAcrossAllVaults + event.params.amountIn,
            updatedAt: timestamp,
        }
        : {
            id: userId,
            address: userAddress,
            totalDepositsAcrossAllVaults: event.params.amountIn,
            totalWithdrawalsAcrossAllVaults: BigInt(0),
            totalPnL: BigInt(0),
            totalRewardsDistributed: BigInt(0),
            createdAt: timestamp,
            updatedAt: timestamp,
        };
    context.User.set(userUpdated);
    // Write to Postgres
    // try {
    //   await postgresWriter.setUser(userUpdated);
    // } catch (error) {
    //   console.error("Failed to write User to Postgres:", error);
    // }
    // Get or create UserVaultPosition
    let userVaultPosition = await context.UserVaultPosition.get(userVaultPositionId);
    const newPositionTotalDeposits = userVaultPosition
        ? userVaultPosition.totalDeposits + event.params.amountIn
        : event.params.amountIn;
    const pnl = userVaultPosition
        ? userVaultPosition.totalWithdrawals - newPositionTotalDeposits
        : BigInt(0);
    const positionUpdated = userVaultPosition
        ? {
            ...userVaultPosition,
            totalDeposits: newPositionTotalDeposits,
            currentShares: userVaultPosition.currentShares + event.params.shares,
            pnl: pnl,
            updatedAt: timestamp,
        }
        : {
            id: userVaultPositionId,
            user_id: userId,
            vault_id: vaultId,
            totalDeposits: event.params.amountIn,
            totalWithdrawals: BigInt(0),
            currentShares: event.params.shares,
            pnl: BigInt(0), // PnL = withdrawals - deposits, starts at 0
            createdAt: timestamp,
            updatedAt: timestamp,
        };
    context.UserVaultPosition.set(positionUpdated);
    // Write to Postgres
    // try {
    //   await postgresWriter.setUserVaultPosition(positionUpdated);
    // } catch (error) {
    //   console.error("Failed to write UserVaultPosition to Postgres:", error);
    // }
    // Create history record for deposit (only in non-preload phase to avoid duplicates)
    if (!context.isPreload) {
        // const amountUSD = calculateUSDValue(event.params.amountIn, Number(tokenDecimals), tokenPriceUSD);
        const historyRecord = {
            id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
            user_id: userId,
            vault_id: vaultId,
            transactionType: "Deposit",
            amount: event.params.amountIn,
            amountUSD: 0,
            shares: event.params.shares,
            blockNumber: BigInt(event.block.number),
            blockTimestamp: timestamp,
            transactionHash: event.transaction.hash || "",
            eventIndex: BigInt(event.logIndex),
            chainId: BigInt(event.chainId),
            createdAt: timestamp,
        };
        context.UserVaultHistory.set(historyRecord);
        // Write to Postgres
        // try {
        //   await postgresWriter.setUserVaultHistory(historyRecord);
        // } catch (error) {
        //   console.error("Failed to write UserVaultHistory to Postgres:", error);
        // }
    }
});
generated_1.TransparentUpgradeableProxy.DepositWithdrawalStatusChanged.handler(async ({ event, context }) => {
    const timestamp = BigInt(event.block.timestamp);
    const vaultAddress = event.srcAddress.toLowerCase();
    const vaultId = `${event.chainId}_${vaultAddress}`;
    // Raw entity creation removed
    // Update Vault status
    let vault = await context.Vault.get(vaultId);
    if (vault) {
        const vaultUpdated = {
            ...vault,
            isDepositsPaused: event.params.bDepositsPaused,
            isWithdrawalsPaused: event.params.bWithdrawalsPaused,
            updatedAt: timestamp,
        };
        context.Vault.set(vaultUpdated);
        // Write to Postgres
        // try {
        //   await postgresWriter.setVault({
        //     ...vaultUpdated,
        //     tokenSymbol: vaultUpdated.tokenSymbol ?? null
        //   });
        // } catch (error) {
        //   console.error("Failed to write Vault to Postgres:", error);
        // }
    }
});
generated_1.TransparentUpgradeableProxy.FeesCollected.handler(async ({ event, context }) => {
    // Logic removed to unnecessary DB writes
});
generated_1.TransparentUpgradeableProxy.ManagementFeeCharged.handler(async ({ event, context }) => {
    const timestamp = BigInt(event.block.timestamp);
    const vaultAddress = event.srcAddress.toLowerCase();
    const vaultId = `${event.chainId}_${vaultAddress}`;
    // Raw entity creation removed
    // Update Vault fees
    let vault = await context.Vault.get(vaultId);
    if (vault) {
        const newTotalManagementFees = vault.totalManagementFees + event.params.managementFeeAmount;
        // Recalculate USD values
        const totalManagementFeesUSD = calculateUSDValue(newTotalManagementFees, Number(vault.tokenDecimals), vault.tokenPriceUSD);
        const tvlUSD = calculateUSDValue(vault.tvl, Number(vault.tokenDecimals), vault.tokenPriceUSD);
        const totalDepositsUSD = calculateUSDValue(vault.totalDeposits, Number(vault.tokenDecimals), vault.tokenPriceUSD);
        const totalWithdrawalsUSD = calculateUSDValue(vault.totalWithdrawals, Number(vault.tokenDecimals), vault.tokenPriceUSD);
        const vaultUpdated = {
            ...vault,
            totalManagementFees: newTotalManagementFees,
            totalManagementFeesUSD: totalManagementFeesUSD,
            tvlUSD: tvlUSD,
            totalDepositsUSD: totalDepositsUSD,
            totalWithdrawalsUSD: totalWithdrawalsUSD,
            updatedAt: timestamp,
        };
        context.Vault.set(vaultUpdated);
        // Write to Postgres
        try {
            await postgresWriter.setVault({
                ...vaultUpdated,
                tokenSymbol: vaultUpdated.tokenSymbol ?? null
            });
        }
        catch (error) {
            console.error("Failed to write Vault to Postgres:", error);
        }
    }
});
generated_1.TransparentUpgradeableProxy.ManagementFeeUpdated.handler(async ({ event, context }) => {
    // Logic removed to unnecessary DB writes
});
generated_1.TransparentUpgradeableProxy.Withdraw.handler(async ({ event, context }) => {
    const timestamp = BigInt(event.block.timestamp);
    const vaultAddress = event.srcAddress.toLowerCase();
    const userAddress = event.params.owner.toLowerCase();
    const vaultId = `${event.chainId}_${vaultAddress}`;
    const userId = userAddress;
    const userVaultPositionId = `${userId}_${vaultId}`;
    // Raw entity creation removed
    // Update Vault
    let vault = await context.Vault.get(vaultId);
    if (vault) {
        const newTVL = vault.tvl > event.params.assets ? vault.tvl - event.params.assets : BigInt(0);
        const newTotalWithdrawals = vault.totalWithdrawals + event.params.assets;
        // Recalculate USD values
        const tvlUSD = calculateUSDValue(newTVL, Number(vault.tokenDecimals), vault.tokenPriceUSD);
        const totalWithdrawalsUSD = calculateUSDValue(newTotalWithdrawals, Number(vault.tokenDecimals), vault.tokenPriceUSD);
        const totalDepositsUSD = calculateUSDValue(vault.totalDeposits, Number(vault.tokenDecimals), vault.tokenPriceUSD);
        const totalManagementFeesUSD = calculateUSDValue(vault.totalManagementFees, Number(vault.tokenDecimals), vault.tokenPriceUSD);
        const vaultUpdated = {
            ...vault,
            tvl: newTVL,
            tvlUSD: tvlUSD,
            totalWithdrawals: newTotalWithdrawals,
            totalWithdrawalsUSD: totalWithdrawalsUSD,
            totalDepositsUSD: totalDepositsUSD,
            totalManagementFeesUSD: totalManagementFeesUSD,
            updatedAt: timestamp,
        };
        context.Vault.set(vaultUpdated);
        // Write to Postgres
        try {
            await postgresWriter.setVault({
                ...vaultUpdated,
                tokenSymbol: vaultUpdated.tokenSymbol ?? null
            });
        }
        catch (error) {
            console.error("Failed to write Vault to Postgres:", error);
        }
    }
    // Update User
    let user = await context.User.get(userId);
    if (user) {
        const newTotalWithdrawals = user.totalWithdrawalsAcrossAllVaults + event.params.assets;
        const newTotalPnL = newTotalWithdrawals - user.totalDepositsAcrossAllVaults;
        const userUpdated = {
            ...user,
            totalWithdrawalsAcrossAllVaults: newTotalWithdrawals,
            totalPnL: newTotalPnL,
            updatedAt: timestamp,
        };
        context.User.set(userUpdated);
        // Write to Postgres
        try {
            await postgresWriter.setUser(userUpdated);
        }
        catch (error) {
            console.error("Failed to write User to Postgres:", error);
        }
    }
    // Update UserVaultPosition
    let userVaultPosition = await context.UserVaultPosition.get(userVaultPositionId);
    if (userVaultPosition) {
        // PnL = (totalWithdrawals + assets) - totalDeposits
        const newTotalWithdrawals = userVaultPosition.totalWithdrawals + event.params.assets;
        const newPnL = newTotalWithdrawals - userVaultPosition.totalDeposits;
        const positionUpdated = {
            ...userVaultPosition,
            totalWithdrawals: newTotalWithdrawals,
            currentShares: userVaultPosition.currentShares > event.params.shares
                ? userVaultPosition.currentShares - event.params.shares
                : BigInt(0),
            pnl: newPnL,
            updatedAt: timestamp,
        };
        context.UserVaultPosition.set(positionUpdated);
        // Write to Postgres
        try {
            await postgresWriter.setUserVaultPosition(positionUpdated);
        }
        catch (error) {
            console.error("Failed to write UserVaultPosition to Postgres:", error);
        }
        // Create history record for withdrawal (only in non-preload phase to avoid duplicates)
        if (!context.isPreload) {
            const vaultForHistory = await context.Vault.get(vaultId);
            if (vaultForHistory) {
                const amountUSD = calculateUSDValue(event.params.assets, Number(vaultForHistory.tokenDecimals), vaultForHistory.tokenPriceUSD);
                const historyRecord = {
                    id: `${event.chainId}_${event.block.number}_${event.logIndex}_withdraw`,
                    user_id: userId,
                    vault_id: vaultId,
                    transactionType: "Withdraw",
                    amount: event.params.assets,
                    amountUSD: amountUSD,
                    shares: event.params.shares,
                    blockNumber: BigInt(event.block.number),
                    blockTimestamp: timestamp,
                    transactionHash: event.transaction.hash || "",
                    eventIndex: BigInt(event.logIndex),
                    chainId: BigInt(event.chainId),
                    createdAt: timestamp,
                };
                context.UserVaultHistory.set(historyRecord);
                // Write to Postgres
                try {
                    await postgresWriter.setUserVaultHistory(historyRecord);
                }
                catch (error) {
                    console.error("Failed to write UserVaultHistory to Postgres:", error);
                }
            }
        }
    }
});
generated_1.TransparentUpgradeableProxy.WithdrawalProcessed.handler(async ({ event, context }) => {
    const timestamp = BigInt(event.block.timestamp);
    const vaultAddress = event.srcAddress.toLowerCase();
    const userAddress = event.params.receiverAddr.toLowerCase();
    const vaultId = `${event.chainId}_${vaultAddress}`;
    const userId = userAddress;
    const userVaultPositionId = `${userId}_${vaultId}`;
    // Raw entity creation removed
    // Update Vault (ensure TVL is updated)
    let vault = await context.Vault.get(vaultId);
    if (vault) {
        const newTVL = vault.tvl > event.params.assetsAmount ? vault.tvl - event.params.assetsAmount : BigInt(0);
        const newTotalWithdrawals = vault.totalWithdrawals + event.params.assetsAmount;
        // Recalculate USD values
        const tvlUSD = calculateUSDValue(newTVL, Number(vault.tokenDecimals), vault.tokenPriceUSD);
        const totalWithdrawalsUSD = calculateUSDValue(newTotalWithdrawals, Number(vault.tokenDecimals), vault.tokenPriceUSD);
        const totalDepositsUSD = calculateUSDValue(vault.totalDeposits, Number(vault.tokenDecimals), vault.tokenPriceUSD);
        const totalManagementFeesUSD = calculateUSDValue(vault.totalManagementFees, Number(vault.tokenDecimals), vault.tokenPriceUSD);
        const vaultUpdated = {
            ...vault,
            tvl: newTVL,
            tvlUSD: tvlUSD,
            totalWithdrawals: newTotalWithdrawals,
            totalWithdrawalsUSD: totalWithdrawalsUSD,
            totalDepositsUSD: totalDepositsUSD,
            totalManagementFeesUSD: totalManagementFeesUSD,
            updatedAt: timestamp,
        };
        context.Vault.set(vaultUpdated);
        // Write to Postgres
        try {
            await postgresWriter.setVault({
                ...vaultUpdated,
                tokenSymbol: vaultUpdated.tokenSymbol ?? null
            });
        }
        catch (error) {
            console.error("Failed to write Vault to Postgres:", error);
        }
    }
    // Update User
    let user = await context.User.get(userId);
    if (user) {
        const newTotalWithdrawals = user.totalWithdrawalsAcrossAllVaults + event.params.assetsAmount;
        const newTotalPnL = newTotalWithdrawals - user.totalDepositsAcrossAllVaults;
        const userUpdated = {
            ...user,
            totalWithdrawalsAcrossAllVaults: newTotalWithdrawals,
            totalPnL: newTotalPnL,
            updatedAt: timestamp,
        };
        context.User.set(userUpdated);
        // Write to Postgres
        try {
            await postgresWriter.setUser(userUpdated);
        }
        catch (error) {
            console.error("Failed to write User to Postgres:", error);
        }
    }
    // Update UserVaultPosition
    let userVaultPosition = await context.UserVaultPosition.get(userVaultPositionId);
    if (userVaultPosition) {
        const newTotalWithdrawals = userVaultPosition.totalWithdrawals + event.params.assetsAmount;
        const newPnL = newTotalWithdrawals - userVaultPosition.totalDeposits;
        const positionUpdated = {
            ...userVaultPosition,
            totalWithdrawals: newTotalWithdrawals,
            pnl: newPnL,
            updatedAt: timestamp,
        };
        context.UserVaultPosition.set(positionUpdated);
        // Write to Postgres
        try {
            await postgresWriter.setUserVaultPosition(positionUpdated);
        }
        catch (error) {
            console.error("Failed to write UserVaultPosition to Postgres:", error);
        }
        // Create history record for withdrawal processed (only in non-preload phase to avoid duplicates)
        if (!context.isPreload) {
            const vaultForHistory = await context.Vault.get(vaultId);
            if (vaultForHistory) {
                const amountUSD = calculateUSDValue(event.params.assetsAmount, Number(vaultForHistory.tokenDecimals), vaultForHistory.tokenPriceUSD);
                const historyRecord = {
                    id: `${event.chainId}_${event.block.number}_${event.logIndex}_withdrawal_processed`,
                    user_id: userId,
                    vault_id: vaultId,
                    transactionType: "WithdrawalProcessed",
                    amount: event.params.assetsAmount,
                    amountUSD: amountUSD,
                    shares: BigInt(0), // WithdrawalProcessed doesn't have shares info
                    blockNumber: BigInt(event.block.number),
                    blockTimestamp: timestamp,
                    transactionHash: event.transaction.hash || "",
                    eventIndex: BigInt(event.logIndex),
                    chainId: BigInt(event.chainId),
                    createdAt: timestamp,
                };
                context.UserVaultHistory.set(historyRecord);
                // Write to Postgres
                try {
                    await postgresWriter.setUserVaultHistory(historyRecord);
                }
                catch (error) {
                    console.error("Failed to write UserVaultHistory to Postgres:", error);
                }
            }
        }
    }
});
generated_1.TransparentUpgradeableProxy.WithdrawalRequested.handler(async ({ event, context }) => {
    // Logic removed to unnecessary DB writes
});
