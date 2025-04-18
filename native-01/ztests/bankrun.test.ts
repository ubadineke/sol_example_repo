// import { describe, expect, test } from '@jest/globals';
import {describe, test} from 'node:test';
import {Buffer} from 'node:buffer'
import {
  BanksClient,
  ProgramTestContext,
  Transaction,
  TransactionInstruction,
} from 'solana-bankrun';
import { 
  PublicKey, 
  Keypair, 
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

// Define program ID and paths
const PROGRAM_ID = new PublicKey('YourProgramId11111111111111111111111111111111');
const DATA_ACCOUNT_SIZE = 8; // 64 bits for our result

describe('Solana Program Overflow Test', () => {
  let context: ProgramTestContext;
  let client: BanksClient;
  let payer: Keypair;
  let dataAccount: Keypair;

  beforeAll(async () => {
    // Setup the program test context with the program
    context = await ProgramTestContext.create(
      'YourProgramName',
      PROGRAM_ID,
      // Path to your compiled program - adjust if necessary
      './target/deploy/your_program.so'
    );
    
    client = context.banksClient;
    payer = context.payer;
    
    // Create a data account to store our result
    dataAccount = new Keypair();
    const createAccountTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: dataAccount.publicKey,
        lamports: LAMPORTS_PER_SOL / 100, // 0.01 SOL
        space: DATA_ACCOUNT_SIZE,
        programId: PROGRAM_ID,
      })
    );
    
    await client.processTransaction(createAccountTx, [payer, dataAccount]);
  });

  test('Arithmetic overflow bug is triggered with large input', async () => {
    // Value that will trigger overflow when multiplied by 1_000_000
    // Max u64: 18446744073709551615
    // Choose a value such that value * 1_000_000 > MAX_U64
    const largeValue = BigInt('18446744073709551'); // When multiplied by 1M will overflow
    
    // Convert to little-endian bytes
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(largeValue);
    
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: dataAccount.publicKey, isSigner: false, isWritable: true },
      ],
      programId: PROGRAM_ID,
      data: buffer,
    });
    
    const tx = new Transaction().add(instruction);
    
    // Process the transaction and let it complete regardless of success or failure
    try {
      await client.processTransaction(tx, [payer]);
    } catch (error) {
      console.log("Transaction failed as expected:", error);
      // On some Solana environments, the overflow might cause a runtime error
    }
    
    // Check the contents of the data account
    const accountInfo = await client.getAccount(dataAccount.publicKey);
    expect(accountInfo).not.toBeNull();
    
    if (accountInfo) {
      // Extract the result stored in the account
      const resultBuffer = accountInfo.data.slice(0, 8);
      const storedResult = resultBuffer.readBigUInt64LE();
      
      // Calculate what the correct result should be in BigInt
      const correctResult = largeValue * BigInt(1_000_000);
      
      // Calculate what the wrapped result would be when overflowing u64
      const maxU64 = BigInt('18446744073709551615');
      const wrappedResult = correctResult % (maxU64 + BigInt(1));
      
      console.log('Input value:', largeValue.toString());
      console.log('Expected correct result:', correctResult.toString());
      console.log('Expected wrapped result:', wrappedResult.toString());
      console.log('Actual stored result:', storedResult.toString());
      
      // The stored result should match the wrapped value due to overflow
      expect(storedResult).toEqual(wrappedResult);
      
      // And it should NOT match the correct mathematical result
      expect(storedResult).not.toEqual(correctResult);
    }
  });
  
  test('Small input value works correctly without overflow', async () => {
    // A value that won't overflow when multiplied by 1_000_000
    const smallValue = BigInt(1000); // 1000 * 1_000_000 = 1_000_000_000
    
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(smallValue);
    
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: dataAccount.publicKey, isSigner: false, isWritable: true },
      ],
      programId: PROGRAM_ID,
      data: buffer,
    });
    
    const tx = new Transaction().add(instruction);
    
    await client.processTransaction(tx, [payer]);
    
    // Check the result
    const accountInfo = await client.getAccount(dataAccount.publicKey);
    expect(accountInfo).not.toBeNull();
    
    if (accountInfo) {
      const resultBuffer = accountInfo.data.slice(0, 8);
      const storedResult = resultBuffer.readBigUInt64LE();
      
      const expectedResult = smallValue * BigInt(1_000_000);
      
      console.log('Small input value:', smallValue.toString());
      console.log('Expected result:', expectedResult.toString());
      console.log('Actual stored result:', storedResult.toString());
      
      expect(storedResult).toEqual(expectedResult);
    }
  });
});


