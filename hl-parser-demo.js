import fs from "fs";

/**
 * Full Parser for Solana Transaction JSON
 * Target File: hl_5.json
 */
function parseTransaction() {
    try {
        // 1. Load the transaction data from the file
        const rawData = fs.readFileSync('hl_3.json', 'utf8');
        const data = JSON.parse(rawData);

        const result = data.result;
        const meta = result.meta;
        const instructions = result.transaction.message.instructions;
        const innerInstructions = meta.innerInstructions;

        // 2. Map inner instructions by their parent index for chronological parsing
        const innerMap = {};
        innerInstructions.forEach(item => {
            innerMap[item.index] = item.instructions;
        });

        const allTransfers = [];
        let globalOrder = 1;

        // 3. Iterate through top-level instructions
        instructions.forEach((mainInst, index) => {
            
            // Process the main instruction if it's a transfer
            if (isTransfer(mainInst)) {
                allTransfers.push(extractTransferData(mainInst, globalOrder++, "Main"));
            }

            // Process any inner instructions triggered by this main instruction[cite: 1]
            if (innerMap[index]) {
                innerMap[index].forEach(innerInst => {
                    if (isTransfer(innerInst)) {
                        allTransfers.push(extractTransferData(innerInst, globalOrder++, "Inner"));
                    }
                });
            }
        });

        // 4. Display the results in a clear format[cite: 1]
        console.log(`--- Parsed Transfers from hl_5.json ---`);
        console.table(allTransfers);

    } catch (error) {
        console.error("Error parsing hl_5.json:", error.message);
    }
}

/**
 * Checks if an instruction (main or inner) is a parsed transfer[cite: 1]
 */
function isTransfer(inst) {
    return inst.parsed && 
           (inst.parsed.type === 'transfer' || inst.parsed.type === 'transferChecked');
}

/**
 * Extracts and normalizes transfer details[cite: 1]
 */
function extractTransferData(inst, order, level) {
    const info = inst.parsed.info;
    const type = inst.parsed.type;
    const program = inst.program || inst.programId;

    // Determine the Asset and UI Amount[cite: 1]
    let asset = "Native SOL";
    let uiAmount = 0;

    if (program === 'spl-token' || program === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
        // Handle Token Transfers[cite: 1]
        if (info.tokenAmount) {
            uiAmount = info.tokenAmount.uiAmount;
            asset = `Token (${info.mint.slice(0, 4)}...)`;
        } else {
            // If uiAmount isn't in the instruction, we use the raw amount[cite: 1]
            uiAmount = info.amount; 
            asset = "SPL Token";
        }
    } else {
        // Handle Native SOL Transfers (10^9 lamports = 1 SOL)[cite: 1]
        uiAmount = info.lamports ? info.lamports / 1000000000 : 0;
    }

    return {
        "Order": order,
        "Level": level,
        "From": info.source || info.authority,
        "To": info.destination,
        "Amount": uiAmount,
        "Asset": asset,
        "Program": program.slice(0, 8) + "..."
    };
}

// Execute the parser
parseTransaction();