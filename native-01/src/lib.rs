use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};

entrypoint!(process_instruction);

pub fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Expect at least one byte of instruction data
    if instruction_data.is_empty() {
        return Err(ProgramError::InvalidInstructionData);
    }

    // Read the first 8 bytes as a u64 (little-endian)
    let amount = u64::from_le_bytes(instruction_data[0..8].try_into().unwrap());

    // Intentional bug: Multiply by 1_000_000 without overflow check
    let result = amount * 1_000_000;

    // Log the result
    msg!("Input amount: {}, Calculated result: {}", amount, result);

    // Store result in the first account's data (for simplicity)
    let account_iter = &mut accounts.iter();
    let account_info = next_account_info(account_iter)?;
    // let account_info = next_account_info(accounts.iter())?;
    let mut data = account_info.data.borrow_mut();
    data[0..8].copy_from_slice(&result.to_le_bytes());

    Ok(())
}

